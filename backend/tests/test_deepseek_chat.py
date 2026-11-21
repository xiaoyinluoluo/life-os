import json
import unittest
from unittest.mock import patch
from uuid import uuid4

from tests import support
import httpx
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.models import CompanionChat
from app.services.database import SessionLocal


class DeepSeekTests(unittest.TestCase):
    def test_provider_isolation_and_json_api(self):
        requests = []
        real_client = httpx.AsyncClient

        def response(request):
            requests.append(request)
            self.assertEqual(str(request.url), 'https://api.deepseek.com/chat/completions')
            body = json.loads(request.content)
            self.assertEqual(body['response_format'], {'type': 'json_object'})
            self.assertIn('JSON', body['messages'][0]['content'])
            result = {'analysis': '测试回复', 'suggestions': ['建议'], 'next_actions': ['行动']}
            return httpx.Response(200, json={'choices': [{'finish_reason': 'stop', 'message': {'content': json.dumps(result)}}]})

        def mocked_client(**kwargs):
            return real_client(transport=httpx.MockTransport(response), **kwargs)

        url = '/api/companion/conversation'
        try:
            with TestClient(app) as client, patch.object(settings, 'deepseek_api_key', 'dummy-key'), patch(
                'app.services.ai.deepseek_chat.httpx.AsyncClient', side_effect=mocked_client,
            ):
                first = {'provider': 'deepseek', 'request_id': str(uuid4()), 'message': '你好'}
                result = client.post(url, json=first)
                self.assertEqual(result.status_code, 200)
                self.assertEqual(result.json()['provider'], 'deepseek')
                self.assertEqual(client.post(url, json=first).json(), result.json())
                self.assertEqual(len(requests), 1)
                second = {'provider': 'deepseek', 'request_id': str(uuid4()), 'message': '再讲一点'}
                self.assertEqual(client.post(url, json=second).status_code, 200)
                self.assertEqual(len(json.loads(requests[-1].content)['messages']), 4)
                self.assertEqual(client.get(url, params={'provider': 'deepseek'}).json()['revision'], 2)
                gpt = client.get(url).json()
                self.assertEqual(gpt['revision'], 0)
                self.assertEqual(client.post(url + '/clear', json={'provider': 'deepseek', 'revision': 2}).status_code, 200)
                self.assertEqual(client.get(url).json(), gpt)
                self.assertEqual(client.get(url, params={'provider': 'unknown'}).status_code, 422)
        finally:
            with SessionLocal() as session:
                state = session.get(CompanionChat, 2)
                if state:
                    session.delete(state)
                    session.commit()
