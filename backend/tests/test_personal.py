import unittest
from tests import support  # configure an isolated SQLite database
from fastapi.testclient import TestClient
from app.main import app
from app.services.database import SessionLocal
from app.models import Goal, Project, Task, UserProfile
from sqlalchemy import delete, select

class PersonalTests(unittest.TestCase):
    def test_profile_and_task_persist_and_validate(self):
        with TestClient(app) as client:
            original = client.get('/api/personal/profile').json()
            original_mode = client.get('/api/personal/workspace').json()['mode']
            try:
                self.assertEqual(client.post('/api/personal/profile', json={**original, 'name': '测试用户'}).status_code, 200)
                self.assertEqual(client.get('/api/personal/profile').json()['name'], '测试用户')
                self.assertEqual(client.post('/api/personal/profile', json={**original, 'name': '  '}).status_code, 422)
                self.assertEqual(client.post('/api/personal/tasks', json={'title': '  '}).status_code, 422)
                created = client.post('/api/personal/tasks', json={'title': '测试任务', 'due_date': '2026-11-17'})
                self.assertEqual(created.status_code, 200)
                task_id = created.json()['id']
                self.assertTrue(any(task['id'] == task_id for task in client.get('/api/personal/tasks').json()))
                self.assertEqual(client.post(f'/api/personal/tasks/{task_id}/status', json={'status': 'done'}).json()['status'], 'done')
                self.assertEqual(client.post(f'/api/personal/tasks/{task_id}/status', json={'status': 'todo'}).json()['status'], 'todo')
                self.assertEqual(client.post('/api/personal/tasks/999999/status', json={'status': 'done'}).status_code, 404)
                edited = client.post(f'/api/personal/tasks/{task_id}/edit', json={'title': '修改后的任务', 'due_date': None})
                self.assertEqual(edited.status_code, 200)
                self.assertIsNone(edited.json()['due_date'])
                self.assertEqual(client.post(f'/api/personal/tasks/{task_id}/edit', json={'title': '  '}).status_code, 422)
                review_url = f'/api/personal/tasks/{task_id}/review'
                self.assertEqual(client.post(review_url, json={'review': '下次先准备资料'}).status_code, 200)
                with SessionLocal() as session:
                    self.assertEqual(session.get(Task, task_id).review, '下次先准备资料')
                    self.assertEqual(session.get(Task, task_id).title, '修改后的任务')
                status_url = f'/api/personal/tasks/{task_id}/status'
                client.post(status_url, json={'status': 'done'})
                with SessionLocal() as session:
                    completed_at = session.get(Task, task_id).completed_at
                client.post(status_url, json={'status': 'done'})
                with SessionLocal() as session:
                    self.assertEqual(session.get(Task, task_id).completed_at, completed_at)
                self.assertEqual(client.post(status_url, json={'status': 'in_progress'}).json()['status'], 'in_progress')
                sample_count = len(client.get('/api/personal/tasks').json())
                self.assertEqual(client.post('/api/personal/workspace', json={'mode': 'personal', 'name': '我的称呼'}).status_code, 200)
                visible = client.get('/api/personal/tasks').json()
                self.assertTrue(any(task['id'] == task_id for task in visible))
                self.assertFalse(any(task['is_demo'] for task in visible))
                self.assertFalse(client.get('/api/dashboard').json()['demo_data'])
                with SessionLocal() as session:
                    demo_goals = set(session.scalars(select(Goal.id).where(Goal.is_demo == 1)))
                self.assertFalse(any(goal['id'] in demo_goals for goal in client.get('/api/companion/goals').json()['items']))
                client.post('/api/personal/workspace', json={'mode': 'demo'})
                self.assertEqual(len(client.get('/api/personal/tasks').json()), sample_count)
            finally:
                client.post('/api/personal/profile', json=original)
                with SessionLocal() as session:
                    session.get(UserProfile, 1).workspace_mode = original_mode
                    goal_ids = list(session.scalars(select(Goal.id).where(Goal.title == '日常生活', Goal.is_demo == 0)))
                    project_ids = list(session.scalars(select(Project.id).where(Project.goal_id.in_(goal_ids))))
                    session.execute(delete(Task).where(Task.project_id.in_(project_ids)))
                    session.execute(delete(Project).where(Project.id.in_(project_ids)))
                    session.execute(delete(Goal).where(Goal.id.in_(goal_ids)))
                    session.commit()
