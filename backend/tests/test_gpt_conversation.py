import json
import unittest
from unittest.mock import patch
from uuid import uuid4

from tests import support

import httpx
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.models import CompanionChat, Goal
from app.services.ai.openai_chat import RESPONSES_URL
from app.services.database import SessionLocal

URL = '/api/companion/conversation'


class GPTConversationTests(unittest.TestCase):
    def test_conversation_storage_context_and_error_handling(self):
        calls = []
        adapter = httpx.AsyncClient
        simulated_status = 200

        def provider(request):
            self.assertEqual(str(request.url), RESPONSES_URL)
            self.assertEqual(request.headers['Authorization'], 'Bearer offline-test-key')
            calls.append(json.loads(request.content))
            if simulated_status != 200:
                return httpx.Response(simulated_status)
            output = {'analysis': '基于对话的回复', 'suggestions': ['重点一'], 'next_actions': ['安排下一步']}
            return httpx.Response(200, json={
                'status': 'completed', 'output': [{'type': 'message', 'content': [
                    {'type': 'output_text', 'text': json.dumps(output, ensure_ascii=False)},
                ]}],
            })

        def test_client(**kwargs):
            return adapter(transport=httpx.MockTransport(provider), **kwargs)

        goal_id = None
        try:
            with TestClient(app) as client, patch.object(settings, 'openai_api_key', 'offline-test-key'), patch(
                'app.services.ai.openai_chat.httpx.AsyncClient', side_effect=test_client,
            ):
                self.assertTrue(client.get(URL).json()['configured'])
                client.get('/api/dashboard')
                client.get('/api/companion/goals')
                self.assertEqual(calls, [])

                first = {'message': '我想练习演讲', 'request_id': str(uuid4())}
                response = client.post(URL, json=first)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(calls[0]['input'], [{'role': 'user', 'content': first['message']}])
                self.assertFalse(calls[0]['store'])
                self.assertTrue(calls[0]['text']['format']['strict'])
                self.assertEqual(client.post(URL, json=first).json(), response.json())
                self.assertEqual(len(calls), 1)

                goal = client.post('/api/personal/goals', json={'title': '演讲目标', 'outcome': '连贯地讲三分钟'}).json()
                goal_id = goal['id']
                second = {'message': '按刚才的建议再细一点', 'request_id': str(uuid4()),
                          'attachment': {'kind': 'goal', 'id': goal_id}}
                response = client.post(URL, json=second)
                self.assertEqual(response.status_code, 200)
                self.assertEqual([item['role'] for item in calls[1]['input']], ['user', 'assistant', 'user'])
                self.assertIn('连贯地讲三分钟', calls[1]['input'][-1]['content'])
                self.assertNotIn('小林', json.dumps(calls[1], ensure_ascii=False))
                persisted = client.get(URL).json()
                self.assertEqual(len(persisted['turns']), 2)
                self.assertEqual(persisted['turns'][1]['attachment'], '演讲目标')

                simulated_status = 429
                rejected = client.post(URL, json={'message': '重试', 'request_id': str(uuid4())})
                self.assertEqual(rejected.status_code, 429)
                self.assertEqual(client.get(URL).json(), persisted)
                self.assertEqual(client.post(URL + '/clear', json={'revision': 0}).status_code, 409)
                cleared = client.post(URL + '/clear', json={'revision': persisted['revision']})
                self.assertEqual(cleared.status_code, 200)
                self.assertEqual(client.get(URL).json()['turns'], [])
        finally:
            with SessionLocal() as session:
                state = session.get(CompanionChat, 1)
                if state:
                    session.delete(state)
                if goal_id is not None:
                    session.delete(session.get(Goal, goal_id))
                session.commit()

    def test_missing_key_keeps_gpt_unavailable(self):
        with TestClient(app) as client, patch.object(settings, 'openai_api_key', ''):
            self.assertFalse(client.get(URL).json()['configured'])
            response = client.post(URL, json={'message': '你好', 'request_id': str(uuid4())})
            self.assertEqual(response.status_code, 503)
