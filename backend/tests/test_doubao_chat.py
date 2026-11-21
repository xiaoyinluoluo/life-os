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


class DoubaoTests(unittest.TestCase):
    def test_doubao_history_and_provider_isolation(self):
        real_client = httpx.AsyncClient
        calls = []

        def provider(request):
            self.assertEqual(str(request.url), 'https://ark.cn-beijing.volces.com/api/v3/chat/completions')
            body = json.loads(request.content)
            self.assertEqual(body['response_format'], {'type': 'json_object'})
            self.assertEqual(body['thinking'], {'type': 'disabled'})
            calls.append(body)
            content = json.dumps({'analysis': '测试回复', 'suggestions': ['建议'], 'next_actions': ['行动']})
            return httpx.Response(200, json={'choices': [{'finish_reason': 'stop', 'message': {'content': content}}]})

        def client_factory(**kwargs):
            return real_client(transport=httpx.MockTransport(provider), **kwargs)

        url = '/api/companion/conversation'
        try:
            with TestClient(app) as client, patch.object(settings, 'doubao_api_key', 'fake-key'), patch(
                'app.services.ai.doubao_chat.httpx.AsyncClient', side_effect=client_factory,
            ):
                original_gpt = client.get(url).json()
                original_deepseek = client.get(url, params={'provider': 'deepseek'}).json()
                self.assertTrue(client.get(url, params={'provider': 'doubao'}).json()['configured'])
                first = {'provider': 'doubao', 'request_id': str(uuid4()), 'message': '你好'}
                first_result = client.post(url, json=first)
                self.assertEqual(first_result.status_code, 200)
                self.assertEqual(client.post(url, json=first).json(), first_result.json())
                self.assertEqual(len(calls), 1)
                second = {'provider': 'doubao', 'request_id': str(uuid4()), 'message': '再讲一点'}
                self.assertEqual(client.post(url, json=second).status_code, 200)
                self.assertEqual(len(calls[-1]['messages']), 4)
                self.assertEqual(client.get(url).json(), original_gpt)
                self.assertEqual(client.get(url, params={'provider': 'deepseek'}).json(), original_deepseek)
                self.assertEqual(client.post(url + '/clear', json={'provider': 'doubao', 'revision': 2}).status_code, 200)
        finally:
            with SessionLocal() as session:
                state = session.get(CompanionChat, 3)
                if state:
                    session.delete(state)
                    session.commit()
