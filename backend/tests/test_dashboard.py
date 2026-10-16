import asyncio
import tempfile
import unittest
from datetime import datetime, date, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from tests import support
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.models import UserProfile, Goal, Project, Task, Memory, Source, VaultSync
from app.models.base import Base
from app.core.config import settings
from app.integrations.obsidian.obsidian_reader import canonical_path
from app.services.database import get_session
from app.services.profiles import seed_demo_profile
from app.services.dashboard_demo import seed_dashboard_demo, BUSINESS_TZ
from app.services.dashboard_service import get_dashboard


class DashboardTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='lifeos-dashboard-test-')
        self.vault = Path(self.temp.name) / 'vault'; self.vault.mkdir()
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.today = datetime.now(BUSINESS_TZ).date()
        with self.sessions() as session:
            seed_demo_profile(session)
            seed_dashboard_demo(session, self.today)
        def session_dependency():
            with self.sessions() as session:
                yield session
        app.dependency_overrides[get_session] = session_dependency
        self.vault_patch = patch.object(settings, 'obsidian_path', self.vault)
        self.vault_patch.start()
        self.client = TestClient(app); self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        app.dependency_overrides.clear()
        self.vault_patch.stop(); self.engine.dispose(); self.temp.cleanup()

    def counts(self):
        with self.sessions() as session:
            return [session.scalar(select(func.count()).select_from(model)) for model in (Goal, Project, Task, Memory, Source, VaultSync)]

    def test_aggregate_contract_and_today_progress(self):
        response = self.client.get('/api/dashboard')
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()
        for field in ('profile', 'goals', 'projects', 'tasks', 'ai_insight', 'knowledge'):
            self.assertIn(field, data)
        self.assertEqual(data['profile']['current_stage'], '探索与验证')
        self.assertEqual(len(data['projects']), 2)
        self.assertEqual(len(data['tasks']), 3)
        self.assertEqual(data['progress'], {'total': 3, 'completed': 1, 'percentage': 33})
        self.assertEqual(data['current_date'], self.today.isoformat())
        self.assertTrue(data['demo_data'])
        self.assertEqual(data['ai_provider'], 'mock')
        self.assertIn('3 项任务', data['ai_insight'])
        self.assertGreater(len(data['ai_suggestions']), 0)
        self.assertEqual(len(data['growth']['completed_tasks']), 2)
        self.assertEqual(len(data['growth']['reviews']), 1)

    def test_dashboard_get_does_not_write_or_rescan_vault(self):
        before = self.counts()
        self.client.get('/api/dashboard'); self.client.get('/api/dashboard')
        self.assertEqual(self.counts(), before)
        self.assertEqual(list(self.vault.iterdir()), [])

    def test_empty_today_is_zero_and_not_nan(self):
        with self.sessions() as session:
            data = asyncio.run(get_dashboard(session, self.today + timedelta(days=5)))
        self.assertEqual(data.progress.percentage, 0)
        self.assertEqual(data.tasks, [])
        self.assertEqual(data.progress.total, 0)

    def test_all_tasks_completed(self):
        with self.sessions() as session:
            for task in session.scalars(select(Task).where(Task.due_date == self.today)):
                task.status = 'done'; task.completed_at = datetime.now(timezone.utc)
            session.commit()
        data = self.client.get('/api/dashboard').json()
        self.assertEqual(data['progress']['percentage'], 100)

    def test_ai_failure_keeps_remaining_data(self):
        with patch('app.services.dashboard_service.get_companion_agent', side_effect=RuntimeError('unavailable')):
            response = self.client.get('/api/dashboard')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['ai_status'], 'unavailable')
        self.assertEqual(len(response.json()['tasks']), 3)

    def test_current_vault_only_and_deleted_files_excluded(self):
        now = datetime.now(timezone.utc)
        vault = canonical_path(self.vault)
        with self.sessions() as session:
            for name, source_vault, status in [('active.md', vault, 'active'), ('deleted.md', vault, 'deleted'), ('other.md', 'other-vault', 'active')]:
                session.add(Source(vault_path=source_vault, file_name=name, file_path=name, content_hash='a'*64, summary='test', tags=[], created_at=now, updated_at=now, indexed_at=now, status=status))
            session.add(VaultSync(vault_path=vault, status='ok', completed_at=now, counts={}, errors=[]))
            session.commit()
        knowledge = self.client.get('/api/dashboard').json()['knowledge']
        self.assertEqual(knowledge['files_count'], 1)
        self.assertEqual(knowledge['sync_status'], 'ok')
        self.assertTrue(knowledge['last_sync'])

    def test_other_profile_data_and_inconsistent_ownership_excluded(self):
        with self.sessions() as session:
            other = UserProfile(id=2, name='Other user', background='', skills=[], interests=[], values=[], goals=[])
            session.add(other); session.flush()
            goal = Goal(profile_id=2, title='Private goal'); session.add(goal); session.flush()
            project = Project(profile_id=2, goal_id=goal.id, title='Private project'); session.add(project); session.flush()
            session.add(Task(profile_id=2, project_id=project.id, title='Private task', due_date=self.today))
            session.add(Task(profile_id=1, project_id=project.id, title='Invalid ownership task', due_date=self.today))
            session.add(Memory(profile_id=2, kind='review', content='Private review'))
            session.commit()
        result = self.client.get('/api/dashboard').text
        self.assertNotIn('Private', result)
        self.assertNotIn('Invalid ownership', result)

    def test_latest_memory_and_seed_preserves_existing_data(self):
        before = self.counts()
        with self.sessions() as session:
            first = session.scalar(select(Goal).order_by(Goal.id))
            first.title = 'Updated real goal'
            session.add(Memory(profile_id=1, kind='status', content='Updated status', created_at=datetime.now(timezone.utc) + timedelta(days=1)))
            session.commit()
            seed_dashboard_demo(session)
        after = self.counts()
        self.assertEqual(after[:3], before[:3])
        data = self.client.get('/api/dashboard').json()
        self.assertEqual(data['profile']['core_goal'], 'Updated real goal')
        self.assertEqual(data['profile']['recent_status'], 'Updated status')

    def test_missing_profile_is_404(self):
        with self.sessions() as session:
            session.delete(session.get(UserProfile, 1)); session.commit()
        self.assertEqual(self.client.get('/api/dashboard').status_code, 404)

    def test_empty_models_show_honest_empty_state(self):
        isolated = create_engine('sqlite://', poolclass=StaticPool)
        Base.metadata.create_all(isolated)
        try:
            with sessionmaker(bind=isolated)() as session:
                seed_demo_profile(session)
                data = asyncio.run(get_dashboard(session))
                self.assertEqual(data.goals, [])
                self.assertEqual(data.projects, [])
                self.assertEqual(data.tasks, [])
                self.assertEqual(data.profile.current_stage, '尚未记录')
                self.assertFalse(data.demo_data)
        finally:
            isolated.dispose()


if __name__ == '__main__':
    unittest.main()
