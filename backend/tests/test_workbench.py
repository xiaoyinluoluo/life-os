import sqlite3
from contextlib import closing
import unittest
from datetime import datetime, timezone
from uuid import uuid4
from unittest.mock import patch
from tests import support
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.models import Source, CompanionChat
from app.services.database import SessionLocal
from app.integrations.obsidian.obsidian_reader import canonical_path
from app.schemas.companion import CompanionResult


class WorkbenchTests(unittest.TestCase):
    def test_notes_actions_review_and_backup(self):
        with TestClient(app) as client:
            note_id = None
            try:
                with SessionLocal() as session:
                    now = datetime.now(timezone.utc)
                    note = Source(vault_path=canonical_path(settings.obsidian_path), file_name='测试笔记',
                                  file_path='test-workbench.md', summary='先练习三分钟演讲', tags=[],
                                  content_hash=uuid4().hex, created_at=now, updated_at=now, indexed_at=now)
                    session.add(note); session.commit(); note_id = note.id
                calls = []
                async def reply(key, model, messages):
                    calls.append(messages)
                    return CompanionResult(analysis='根据《测试笔记》', suggestions=[], next_actions=['练习演讲'])
                with patch.object(settings, 'openai_api_key', 'offline'), patch('app.api.companion_chat.generate_reply', side_effect=reply):
                    response = client.post('/api/companion/conversation', json={'request_id': str(uuid4()),
                        'message': '帮我安排', 'attachment': {'kind': 'note', 'id': note_id}})
                    self.assertEqual(response.status_code, 200, response.text)
                    self.assertIn('先练习三分钟演讲', calls[0][-1]['content'])
                    self.assertEqual(response.json()['turns'][-1]['attachment'], '测试笔记')
                    with SessionLocal() as session:
                        note = session.get(Source, note_id); note.status = 'deleted'; session.commit()
                    self.assertEqual(client.post('/api/companion/conversation', json={'request_id': str(uuid4()),
                        'message': '再安排', 'attachment': {'kind': 'note', 'id': note_id}}).status_code, 404)
                payload = {'title': '行动测试', 'source_key': str(uuid4())}
                first = client.post('/api/personal/tasks', json=payload).json()
                self.assertEqual(client.post('/api/personal/tasks', json=payload).json()['id'], first['id'])
                client.post(f"/api/personal/tasks/{first['id']}/status", json={'status': 'done'})
                self.assertIn(first['id'], [t['id'] for t in client.get('/api/workbench/week').json()['completed']])
                self.assertEqual(client.post('/api/workbench/day', json={'minutes': 60, 'estimates': {str(first['id']): 20}}).status_code, 200)
                self.assertEqual(client.get('/api/workbench/day').json()['minutes'], 60)
                self.assertEqual(client.post('/api/workbench/day', json={'minutes': 60, 'estimates': {'1': -1}}).status_code, 422)
                self.assertEqual(client.post('/api/workbench/week', json={'adjustment': '下周少安排一项'}).status_code, 200)
                self.assertEqual(client.get('/api/workbench/week').json()['reflection']['adjustment'], '下周少安排一项')
                insight = client.post('/api/workbench/insights', json={'title': '经确认的结论', 'body': '先做最小行动再调整'})
                self.assertEqual(insight.status_code, 200)
                self.assertTrue(any(item['id'] == insight.json()['id'] for item in client.get('/api/workbench/insights').json()))
                backup = client.post('/api/workbench/backups', json={}).json()['name']
                data = client.get('/api/workbench/backups/' + backup)
                self.assertEqual(data.status_code, 200)
                with closing(sqlite3.connect(settings.database_path.parent / 'backups' / backup)) as db:
                    self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
                    self.assertEqual(db.execute('select title from tasks where id=?', (first['id'],)).fetchone()[0], '行动测试')
                client.post('/api/personal/tasks/organize', json={'ids': [first['id']], 'action': 'archive'})
            finally:
                with SessionLocal() as session:
                    note = session.get(Source, note_id) if note_id else None
                    if note: session.delete(note)
                    state = session.get(CompanionChat, 1)
                    if state: session.delete(state)
                    session.commit()
