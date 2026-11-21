import unittest
from uuid import uuid4
from tests import support
from fastapi.testclient import TestClient
from app.main import app


class ExperimentTests(unittest.TestCase):
    def test_persistence_task_idempotency_and_review(self):
        with TestClient(app) as client:
            goal = client.post('/api/personal/goals', json={'title': '验证学习方式'}).json()
            payload = {'goal_id': goal['id'], 'choice': '先实践再读书',
                       'reconsider': '无法独立完成练习时调整', 'evidence': '一次练习记录',
                       'experiment': '独立完成一道练习', 'due_date': '2026-11-20', 'request_id': str(uuid4())}
            response = client.post('/api/workbench/experiments', json=payload)
            self.assertEqual(response.status_code, 200, response.text)
            item = response.json()
            self.assertIsNotNone(item['task_id'])
            self.assertEqual(client.post('/api/workbench/experiments', json=payload).json(), item)
            tasks = client.get('/api/personal/tasks').json()
            task = next(t for t in tasks if t['id'] == item['task_id'])
            self.assertEqual(task['goal_id'], goal['id'])
            self.assertEqual(task['due_date'], '2026-11-20')
        # A new app lifecycle/session still reads the same durable decision.
        with TestClient(app) as client:
            self.assertIn(item, client.get('/api/workbench/experiments').json())
            schedule_url = f"/api/workbench/experiments/{item['id']}/schedule"
            self.assertEqual(client.post(schedule_url, json={'due_date': None}).json()['due_date'], None)
            self.assertEqual(client.post(schedule_url, json={'due_date': '2026-11-21'}).json()['due_date'], '2026-11-21')
            url = f"/api/workbench/experiments/{item['id']}/resolve"
            self.assertEqual(client.post(url, json={'result': ' ', 'outcome': 'pause'}).status_code, 422)
            resolved = client.post(url, json={'result': '需要先补基础', 'outcome': 'shrink', 'keep_insight': True}).json()
            self.assertEqual(resolved['status'], 'resolved')
            self.assertEqual(client.post(schedule_url, json={'due_date': None}).status_code, 409)
            self.assertEqual(client.post(url, json={'result': '重复提交', 'outcome': 'finish', 'keep_insight': True}).json(), resolved)
            insights = client.get('/api/workbench/insights').json()
            insight = next(i for i in insights if i['id'] == resolved['insight_id'])
            self.assertEqual(insight['experiment_id'], item['id'])
            self.assertIn('需要先补基础', insight['body'])
            updated = next(g for g in client.get('/api/personal/goals').json() if g['id'] == goal['id'])
            self.assertEqual(updated['status'], 'active')
            self.assertEqual(len(updated['decisions']), 1)

    def test_minimal_and_invalid_inputs(self):
        with TestClient(app) as client:
            goal = client.post('/api/personal/goals', json={'title': '最小判断'}).json()
            payload = {'goal_id': goal['id'], 'choice': '试试看', 'reconsider': '没有效果', 'request_id': str(uuid4())}
            item = client.post('/api/workbench/experiments', json=payload).json()
            self.assertIsNone(item['task_id'])
            self.assertIsNone(item['due_date'])
            for changes in ({'choice': ' '}, {'due_date': 'invalid'}, {'request_id': '../bad'}):
                self.assertEqual(client.post('/api/workbench/experiments', json={**payload, **changes}).status_code, 422)
            self.assertEqual(client.post('/api/workbench/experiments', json={**payload, 'goal_id': 999999, 'request_id': str(uuid4())}).status_code, 404)
            client.post(f"/api/personal/goals/{goal['id']}/decisions", json={'status': 'paused', 'note': '暂缓'})
            self.assertEqual(client.post('/api/workbench/experiments', json={**payload, 'request_id': str(uuid4())}).status_code, 409)
