"""Tool safety contracts, isolated SQLite only; no network or real user writes."""
import asyncio
import hashlib
import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from tests import support

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.models import Goal, Project, Task, Source, UserProfile, ToolProposal, ToolExecutionLog
from app.models.base import Base
from app.services.database import get_session
from app.services.profiles import seed_demo_profile
from app.services.dashboard_demo import seed_dashboard_demo
from app.services.tool_actions import confirmation_lock
from app.services.tool_schema import upgrade_tool_columns
from app.integrations.obsidian.obsidian_reader import canonical_path
from app.core.config import settings
from app.tools.base import ToolContext, ToolError
from app.tools.registry import registry
from app.tools.task_tool import CreateTaskTool


class ToolTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(bind=self.engine, expire_on_commit=False, autoflush=False)
        with self.sessions() as session:
            seed_demo_profile(session)
            seed_dashboard_demo(session)
            self.goal_id = session.scalar(select(Goal.id).where(Goal.profile_id == 1))
            self.task_id = session.scalar(select(Task.id).where(Task.profile_id == 1))
        def isolated_session():
            with self.sessions() as session:
                yield session
        app.dependency_overrides[get_session] = isolated_session
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        self.engine.dispose()

    def count(self, model):
        with self.sessions() as session:
            return session.scalar(select(func.count()).select_from(model))

    def preview(self, **extra):
        body = {'message': '我想参加 AI Agent 比赛，帮我规划一下。', 'goal_id': self.goal_id}
        body.update(extra)
        response = self.client.post('/api/companion/actions/preview', json=body)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def confirm(self, proposal, **extra):
        body = {'confirmation_token': proposal['confirmation_token'], 'confirmed': True}
        body.update(extra)
        return self.client.post('/api/companion/actions/' + proposal['id'] + '/confirm', json=body)

    def test_01_read_profile_and_audit(self):
        result = self.client.post('/api/tools/get_profile/execute', json={'arguments': {}})
        self.assertEqual(result.status_code, 200)
        self.assertIn('小林', result.json()['name'])
        self.assertTrue(all(key in result.json() for key in ('background', 'skills', 'interests', 'values', 'goals')))
        logs = self.client.get('/api/tools/logs').json()['items']
        self.assertEqual(logs[0]['tool_name'], 'get_profile')
        self.assertEqual(logs[0]['execution_status'], 'success')

    def test_02_search_index_and_ignore_deleted_or_other_vault(self):
        now = datetime.now(timezone.utc)
        with self.sessions() as session:
            for index, (vault, status) in enumerate(((canonical_path(settings.obsidian_path), 'active'), (canonical_path(settings.obsidian_path), 'deleted'), ('other-vault', 'active'))):
                session.add(Source(vault_path=vault, file_name='Agent 比赛%d.md' % index, file_path='note%d.md' % index,
                    content_hash='a' * 64, summary='参加 Agent 比赛的项目经验', tags=['AI'], created_at=now, updated_at=now, indexed_at=now, status=status))
            session.commit()
        response = self.client.post('/api/tools/search_knowledge/execute', json={'arguments': {'query': 'Agent 比赛'}})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()['items']), 1)
        self.assertEqual(response.json()['items'][0]['match'], 'keyword')

    def test_03_create_project_after_confirmation(self):
        proposal = self.preview()
        self.assertEqual(self.confirm(proposal).status_code, 200)
        with self.sessions() as session:
            project = session.scalar(select(Project).where(Project.is_demo == 0))
            self.assertEqual(project.goal_id, self.goal_id)
            self.assertIn('比赛', project.title)
            self.assertEqual(project.description, '我想参加 AI Agent 比赛，帮我规划一下。')

    def test_04_create_tasks_with_fields(self):
        response = self.confirm(self.preview())
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertEqual(len(result['task_ids']), 5)
        with self.sessions() as session:
            rows = session.scalars(select(Task).where(Task.id.in_(result['task_ids'])).order_by(Task.id)).all()
            self.assertEqual(rows[0].priority, 'high')
            self.assertTrue(all(row.project_id == result['project_id'] and row.description and row.due_date and row.status == 'todo' for row in rows))

    def test_05_preview_and_unconfirmed_requests_never_write_business_data(self):
        before = (self.count(Project), self.count(Task))
        proposal = self.preview()
        self.assertEqual(self.confirm(proposal, confirmed=False).status_code, 403)
        self.assertEqual((self.count(Project), self.count(Task)), before)
        self.assertEqual(self.client.get('/api/companion/actions/' + proposal['id']).json()['status'], 'pending')

    def test_06_confirm_then_read_persisted_plan(self):
        before = (self.count(Project), self.count(Task))
        proposal = self.preview()
        result = self.confirm(proposal)
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual((self.count(Project), self.count(Task)), (before[0] + 1, before[1] + 5))
        detail = self.client.get('/api/companion/actions/' + proposal['id']).json()
        self.assertEqual(detail['status'], 'executed')
        self.assertEqual(len(detail['tasks']), 5)
        self.assertEqual(detail['project']['id'], result.json()['project_id'])
        self.assertNotIn('confirmation_token', detail)

    def test_generic_api_and_tool_method_cannot_bypass_confirmation(self):
        inputs = {'create_project': {'goal_id': self.goal_id, 'title': 'Forbidden'},
            'create_task': {'project_id': 1, 'title': 'Forbidden'}, 'update_task': {'task_id': self.task_id, 'status': 'done'}}
        before = (self.count(Project), self.count(Task))
        for name, arguments in inputs.items():
            with self.subTest(name=name):
                self.assertEqual(self.client.post('/api/tools/' + name + '/execute', json={'arguments': arguments}).status_code, 403)
                with self.sessions() as session:
                    with self.assertRaises(ToolError) as raised:
                        registry.execute(name, arguments, ToolContext(session=session))
                    self.assertEqual(raised.exception.status_code, 403)
        self.assertEqual((self.count(Project), self.count(Task)), before)

    def test_pending_proposal_id_is_not_an_authorization(self):
        proposal = self.preview()
        with self.sessions() as session:
            with self.assertRaises(ToolError) as raised:
                registry.execute('create_project', proposal['operations'][0]['arguments'], ToolContext(session=session, proposal_id=proposal['id'], operation_index=0))
            self.assertEqual(raised.exception.status_code, 403)

    def test_confirmation_is_idempotent(self):
        proposal = self.preview()
        first = self.confirm(proposal)
        second = self.confirm(proposal)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertTrue(second.json()['already_executed'])
        self.assertEqual(first.json()['task_ids'], second.json()['task_ids'])
        self.assertEqual(self.count(Project), 3)  # two demo projects plus one real plan
        with self.sessions() as session:
            logs = session.scalars(select(ToolExecutionLog).where(ToolExecutionLog.tool_name == 'create_task', ToolExecutionLog.execution_status == 'success')).all()
            self.assertEqual(len(logs), 5)

    def test_bad_token_and_token_from_other_proposal_denied(self):
        proposal, other = self.preview(), self.preview()
        for token in ('x' * 40, other['confirmation_token']):
            self.assertEqual(self.confirm(proposal, confirmation_token=token).status_code, 403)
        self.assertEqual(self.count(Project), 2)
        serialized = json.dumps(self.client.get('/api/tools/logs').json())
        self.assertNotIn(proposal['confirmation_token'], serialized)
        self.assertNotIn(other['confirmation_token'], serialized)

    def test_confirmation_payload_cannot_replace_operations(self):
        proposal = self.preview()
        self.assertEqual(self.confirm(proposal, operations=[]).status_code, 422)
        self.assertEqual(self.confirm(proposal, confirmed='true').status_code, 422)
        self.assertEqual(self.count(Project), 2)

    def test_tampered_saved_proposal_is_rejected(self):
        proposal = self.preview()
        with self.sessions() as session:
            row = session.get(ToolProposal, proposal['id'])
            operations = json.loads(json.dumps(row.operations))
            operations[0]['arguments']['title'] = 'Tampered'
            row.operations = operations
            session.commit()
        self.assertEqual(self.confirm(proposal).status_code, 409)
        self.assertEqual(self.count(Project), 2)

    def test_expired_and_cancelled_plans_cannot_execute(self):
        proposal = self.preview()
        with self.sessions() as session:
            session.get(ToolProposal, proposal['id']).expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
            session.commit()
        self.assertEqual(self.confirm(proposal).status_code, 409)
        self.assertEqual(self.client.get('/api/companion/actions/' + proposal['id']).json()['status'], 'expired')
        other = self.preview()
        self.assertEqual(self.client.post('/api/companion/actions/' + other['id'] + '/cancel', json={'confirmation_token': other['confirmation_token']}).status_code, 200)
        self.assertEqual(self.confirm(other).status_code, 409)
        self.assertEqual(self.count(Project), 2)

    def test_partial_failure_rolls_back_project_and_every_task_and_audits(self):
        proposal = self.preview()
        before = (self.count(Project), self.count(Task))
        original = CreateTaskTool._execute
        calls = []
        def fail_third(tool, context, values):
            calls.append(values.title)
            if len(calls) == 3:
                raise ToolError('Injected failure', 409)
            return original(tool, context, values)
        with patch.object(CreateTaskTool, '_execute', fail_third):
            self.assertEqual(self.confirm(proposal).status_code, 409)
        self.assertEqual((self.count(Project), self.count(Task)), before)
        self.assertEqual(self.client.get('/api/companion/actions/' + proposal['id']).json()['status'], 'failed')
        with self.sessions() as session:
            logs = session.scalars(select(ToolExecutionLog).where(ToolExecutionLog.proposal_id == proposal['id'])).all()
            self.assertEqual(sum(row.execution_status == 'rolled_back' for row in logs), 3)
            self.assertFalse(any(row.execution_status == 'success' for row in logs))

    def test_update_task_requires_preview_confirmation_and_can_clear_date(self):
        before = self.count(Task)
        body = {'message': '完成这个任务', 'action_type': 'update_task', 'task_id': self.task_id,
            'changes': {'status': 'done', 'priority': 'high', 'due_date': '2026-11-01'}}
        response = self.client.post('/api/companion/actions/preview', json=body)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.confirm(response.json()).status_code, 200)
        with self.sessions() as session:
            task = session.get(Task, self.task_id)
            self.assertEqual((task.status, task.priority, task.due_date.isoformat()), ('done', 'high', '2026-11-01'))
            self.assertIsNotNone(task.completed_at)
        body['changes'] = {'status': 'todo', 'due_date': None}
        proposal = self.client.post('/api/companion/actions/preview', json=body).json()
        self.assertEqual(self.confirm(proposal).status_code, 200)
        with self.sessions() as session:
            task = session.get(Task, self.task_id)
            self.assertIsNone(task.due_date)
            self.assertIsNone(task.completed_at)
        self.assertEqual(self.count(Task), before)

    def test_update_rejects_unallowed_fields_empty_changes_and_bad_values(self):
        for changes in ({}, {'title': 'changed'}, {'status': 'deleted'}, {'priority': None}, {'due_date': 'not-a-date'}):
            response = self.client.post('/api/companion/actions/preview', json={'message': 'change', 'action_type': 'update_task', 'task_id': self.task_id, 'changes': changes})
            self.assertEqual(response.status_code, 422, response.text)

    def test_other_profile_goal_and_task_are_inaccessible(self):
        with self.sessions() as session:
            session.add(UserProfile(id=2, name='Other', background='', skills=[], interests=[], values=[], goals=[]))
            goal = Goal(profile_id=2, title='Private', status='active', is_demo=0)
            session.add(goal); session.flush()
            project = Project(profile_id=2, goal_id=goal.id, title='Private', status='active', is_demo=0)
            session.add(project); session.flush()
            task = Task(profile_id=2, project_id=project.id, title='Private', status='todo', is_demo=0)
            session.add(task); session.commit()
            goal_id, task_id = goal.id, task.id
        self.assertEqual(self.client.post('/api/companion/actions/preview', json={'message': 'test', 'goal_id': goal_id}).status_code, 404)
        self.assertEqual(self.client.post('/api/companion/actions/preview', json={'message': 'test', 'action_type': 'update_task', 'task_id': task_id, 'changes': {'status': 'done'}}).status_code, 404)

    def test_goal_removed_or_paused_after_preview_blocks_execution(self):
        proposal = self.preview()
        with self.sessions() as session:
            session.get(Goal, self.goal_id).status = 'paused'
            session.commit()
        self.assertEqual(self.confirm(proposal).status_code, 409)
        self.assertEqual(self.count(Project), 2)

    def test_registry_lists_five_tools_and_no_delete(self):
        tools = self.client.get('/api/tools').json()['items']
        self.assertEqual({row['name'] for row in tools}, {'get_profile', 'search_knowledge', 'create_project', 'create_task', 'update_task'})
        for tool in tools:
            self.assertIn('properties', tool['parameters'])
            self.assertTrue(tool['description'])
            self.assertEqual(tool['requires_confirmation'], tool['name'] in {'create_project', 'create_task', 'update_task'})

    def test_parallel_confirmation_is_rejected_while_executing(self):
        proposal = self.preview()
        confirmation_lock.acquire()
        try:
            self.assertEqual(self.confirm(proposal).status_code, 409)
            self.assertEqual(self.count(Project), 2)
        finally:
            confirmation_lock.release()
        self.assertEqual(self.confirm(proposal).status_code, 200)

    def test_unknown_tools_and_unbounded_search_are_rejected(self):
        self.assertEqual(self.client.post('/api/tools/delete_task/execute', json={'arguments': {}}).status_code, 404)
        for arguments in ({'query': ''}, {'query': 'AI', 'limit': 100}, {'query': 'AI', 'path': 'other'}):
            self.assertEqual(self.client.post('/api/tools/search_knowledge/execute', json={'arguments': arguments}).status_code, 422)


class ToolSchemaTests(unittest.TestCase):
    def test_legacy_schema_upgrade_preserves_rows_and_is_repeatable(self):
        with tempfile.TemporaryDirectory(prefix='lifeos-migration-') as temporary:
            engine = create_engine('sqlite:///' + str(Path(temporary) / 'legacy.db'))
            try:
                with engine.begin() as connection:
                    connection.exec_driver_sql('CREATE TABLE projects (id INTEGER PRIMARY KEY, title TEXT NOT NULL)')
                    connection.exec_driver_sql('CREATE TABLE tasks (id INTEGER PRIMARY KEY, title TEXT NOT NULL)')
                    connection.exec_driver_sql("INSERT INTO projects VALUES (1, 'saved project')")
                    connection.exec_driver_sql("INSERT INTO tasks VALUES (1, 'saved task')")
                upgrade_tool_columns(engine)
                upgrade_tool_columns(engine)
                with engine.connect() as connection:
                    self.assertEqual(tuple(connection.exec_driver_sql('SELECT title, description FROM projects').one()), ('saved project', ''))
                    self.assertEqual(tuple(connection.exec_driver_sql('SELECT title, description, priority FROM tasks').one()), ('saved task', '', 'medium'))
            finally:
                engine.dispose()
