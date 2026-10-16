"""Isolated tests: temp SQLite, no live demo data and no model network calls."""
import asyncio
import json
import unittest
from unittest.mock import patch
from tests import support  # isolate configuration before app imports

from fastapi.testclient import TestClient
from app.main import app
from app.agents.companion import LifeCompanionAgent
from app.agents.prompts import PROFILE_MARKER
from app.models.user_profile import UserProfile
from app.services.database import SessionLocal, engine, initialize_database


class CompanionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client_context = TestClient(app)
        cls.client = cls.client_context.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client_context.__exit__(None, None, None)
        engine.dispose()

    def test_chat_contract_and_profile_context(self):
        response = self.client.post('/api/companion/chat', json={'message': '我想探索学习方向'})
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(set(result), {'analysis', 'suggestions', 'next_actions'})
        self.assertIn('小林', result['analysis'])
        self.assertIn('写作', result['analysis'])
        self.assertIsInstance(result['analysis'], str)
        for field in ('suggestions', 'next_actions'):
            self.assertGreater(len(result[field]), 0)
            self.assertTrue(all(isinstance(item, str) for item in result[field]))

    def test_emotion_branch(self):
        response = self.client.post('/api/companion/chat', json={'message': '最近压力大，很累'})
        self.assertEqual(response.status_code, 200)
        self.assertIn('压力', response.json()['analysis'])

    def test_invalid_inputs(self):
        for payload in ({}, {'message': ''}, {'message': ' \n\t '}, {'message': 'x' * 4001}, {'message': 123}, {'message': None}):
            with self.subTest(payload=str(payload)[:40]):
                self.assertEqual(self.client.post('/api/companion/chat', json=payload).status_code, 422)

    def test_root_health_and_cors_preserved(self):
        self.assertEqual(self.client.get('/').text, 'Life OS Backend Running')
        self.assertEqual(self.client.get('/health').json()['database'], 'connected')
        preflight = self.client.options('/api/companion/chat', headers={'Origin': 'http://localhost:5173', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type'})
        self.assertEqual(preflight.status_code, 200)
        self.assertEqual(preflight.headers['access-control-allow-origin'], 'http://localhost:5173')

    def test_seed_does_not_overwrite_saved_profile(self):
        with SessionLocal() as session:
            profile = session.get(UserProfile, 1)
            original = profile.name
            profile.name = 'Updated demo name'
            session.commit()
        try:
            initialize_database()
            with SessionLocal() as session:
                self.assertEqual(session.get(UserProfile, 1).name, 'Updated demo name')
        finally:
            with SessionLocal() as session:
                session.get(UserProfile, 1).name = original
                session.commit()

    def test_agent_passes_all_profile_fields_and_message_to_model(self):
        class CaptureModel:
            async def generate(model_self, system_prompt, user_message):
                model_self.prompt = system_prompt
                model_self.message = user_message
                return {'analysis': 'Captured', 'suggestions': ['A'], 'next_actions': ['B']}
        model = CaptureModel()
        with SessionLocal() as session:
            result = asyncio.run(LifeCompanionAgent(session, model).respond('Original question'))
            profile = json.loads(model.prompt.split(PROFILE_MARKER, 1)[1])
            self.assertEqual(set(profile), {'name', 'background', 'skills', 'interests', 'values', 'goals'})
            self.assertEqual(model.message, 'Original question')
            self.assertEqual(result.analysis, 'Captured')

    def test_missing_profile_is_404(self):
        with SessionLocal() as session:
            session.delete(session.get(UserProfile, 1))
            session.commit()
        try:
            self.assertEqual(self.client.post('/api/companion/chat', json={'message': 'hello'}).status_code, 404)
        finally:
            initialize_database()

    def test_invalid_model_output_is_502(self):
        class BrokenModel:
            async def generate(self, system_prompt, user_message):
                return {'analysis': 'bad', 'suggestions': 'wrong type'}
        with patch('app.agents.registry.get_model_client', return_value=BrokenModel()):
            self.assertEqual(self.client.post('/api/companion/chat', json={'message': 'hello'}).status_code, 502)

    def test_timeout_is_504(self):
        class TimeoutAgent:
            async def respond(self, message):
                raise asyncio.TimeoutError()
        with patch('app.api.companion.get_companion_agent', return_value=TimeoutAgent()):
            self.assertEqual(self.client.post('/api/companion/chat', json={'message': 'hello'}).status_code, 504)


if __name__ == '__main__':
    unittest.main()
