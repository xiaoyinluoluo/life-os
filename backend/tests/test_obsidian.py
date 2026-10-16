import hashlib
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from tests import support
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.core.config import settings
from app.models.base import Base
from app.models.source import Source, SourceRevision, VaultSync
from app.services.database import get_session
from app.services.profiles import seed_demo_profile
from app.services.sync_service import sync_vault, sync_lock
from app.integrations.obsidian.obsidian_reader import ObsidianReader


class ObsidianTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='lifeos-vault-test-')
        self.vault = Path(self.temp.name) / 'vault'
        self.vault.mkdir()
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(bind=self.engine, expire_on_commit=False)
        with self.sessions() as session:
            seed_demo_profile(session)
        def session_dependency():
            with self.sessions() as session:
                yield session
        app.dependency_overrides[get_session] = session_dependency
        self.vault_patch = patch.object(settings, 'obsidian_path', self.vault)
        self.vault_patch.start()
        self.client = TestClient(app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        app.dependency_overrides.clear()
        self.vault_patch.stop()
        self.engine.dispose()
        self.temp.cleanup()

    def note(self, name='career.md', text='# 职业方向\n我希望从事人工智能产品设计。 #成长 #career/ai'):
        path = self.vault / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding='utf-8')
        return path

    def sync(self):
        response = self.client.post('/api/obsidian/sync')
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_metadata_tags_nested_and_read_only(self):
        path = self.note('nested/职业.MD', '---\ntags: [career, "成长"]\n---\n# 职业方向\n人工智能产品研究。 #career/ai\n```python\n#not-a-tag\n```')
        before = (path.read_bytes(), path.stat().st_mtime_ns)
        (self.vault / '.obsidian').mkdir()
        (self.vault / '.obsidian' / 'hidden.md').write_text('private settings', encoding='utf-8')
        (self.vault / 'other.txt').write_text('not markdown', encoding='utf-8')
        result = self.sync()
        self.assertEqual(result['added'], 1)
        item = self.client.get('/api/obsidian/files').json()['items'][0]
        self.assertEqual(item['file_name'], '职业.MD')
        self.assertEqual(set(item['tags']), {'career', '成长', 'career/ai'})
        self.assertIn('人工智能', item['summary'])
        self.assertEqual(item['content_hash'], hashlib.sha256(before[0]).hexdigest())
        self.assertTrue(item['updated_at'].endswith('Z'))
        self.assertEqual((path.read_bytes(), path.stat().st_mtime_ns), before)

    def test_frontmatter_block_tags(self):
        self.note(text='---\ntags:\n  - 成长\n  - "career/ai"\n---\n内容')
        self.sync()
        item = self.client.get('/api/obsidian/files').json()['items'][0]
        self.assertEqual(set(item['tags']), {'成长', 'career/ai'})

    def test_incremental_update_delete_restore_and_history(self):
        path = self.note()
        self.assertEqual(self.sync()['added'], 1)
        self.assertEqual(self.sync()['unchanged'], 1)
        path.write_text('# 新方向\n研究人工智能教育产品。', encoding='utf-8')
        self.assertEqual(self.sync()['updated'], 1)
        original_id = self.client.get('/api/obsidian/files').json()['items'][0]['id']
        path.unlink()  # disposable fixture only, never user's vault
        self.assertEqual(self.sync()['deleted'], 1)
        self.assertEqual(self.client.get('/api/obsidian/files').json()['file_count'], 0)
        deleted = self.client.get('/api/obsidian/files?include_deleted=true').json()['items'][0]
        self.assertEqual(deleted['id'], original_id)
        self.assertEqual(deleted['status'], 'deleted')
        self.assertEqual(self.sync()['deleted'], 0)
        self.note(text='# 恢复笔记\n人工智能职业。')
        self.assertEqual(self.sync()['restored'], 1)
        with self.sessions() as session:
            self.assertEqual(session.scalar(select(func.count()).select_from(Source)), 1)
            events = list(session.scalars(select(SourceRevision.event).order_by(SourceRevision.id)))
            self.assertEqual(events, ['added', 'updated', 'deleted', 'restored'])
            summaries = list(session.scalars(select(SourceRevision.summary).order_by(SourceRevision.id)))
            self.assertIn('产品设计', summaries[0])
            self.assertIn('教育产品', summaries[1])

    def test_missing_vault_does_not_tombstone_existing_notes(self):
        self.note(); self.sync()
        with patch.object(settings, 'obsidian_path', self.vault / 'missing'):
            self.assertEqual(self.client.post('/api/obsidian/sync').status_code, 400)
        self.assertEqual(self.client.get('/api/obsidian/files').json()['file_count'], 1)

    def test_partial_read_does_not_mark_deletions(self):
        path = self.note(); self.note('keep.md'); self.sync()
        path.unlink()
        (self.vault / 'bad.md').write_bytes(b'\xff\xfe\xff')
        result = self.sync()
        self.assertEqual(result['status'], 'partial')
        self.assertEqual(result['deleted'], 0)
        self.assertEqual(self.client.get('/api/obsidian/files').json()['file_count'], 2)

    def test_large_file_reports_error(self):
        self.note(text='x' * 100)
        with patch.object(settings, 'obsidian_max_file_bytes', 10):
            result = self.sync()
        self.assertEqual(result['status'], 'partial')
        self.assertEqual(result['added'], 0)

    def test_sync_rollback_keeps_history_atomic(self):
        self.note()
        with patch('app.services.sync_service.record_revision', side_effect=RuntimeError('test rollback')):
            with self.sessions() as session:
                with self.assertRaises(RuntimeError):
                    sync_vault(session, ObsidianReader(self.vault))
        with self.sessions() as session:
            for model in (Source, SourceRevision, VaultSync):
                self.assertEqual(session.scalar(select(func.count()).select_from(model)), 0)

    def test_concurrent_sync_rejected(self):
        sync_lock.acquire()
        try:
            self.assertEqual(self.client.post('/api/obsidian/sync').status_code, 409)
        finally:
            sync_lock.release()

    def test_companion_uses_only_current_vault_active_sources(self):
        path = self.note(); self.sync()
        response = self.client.post('/api/companion/chat', json={'message': '我的职业方向适合人工智能吗？'})
        self.assertEqual(response.status_code, 200)
        self.assertIn('career.md', response.json()['analysis'])
        self.assertIn('产品设计', response.json()['analysis'])
        path.unlink(); self.sync()
        response = self.client.post('/api/companion/chat', json={'message': '我的职业方向适合人工智能吗？'})
        self.assertNotIn('career.md', response.json()['analysis'])
        with patch.object(settings, 'obsidian_path', self.vault / 'missing'):
            response = self.client.post('/api/companion/chat', json={'message': '职业方向'})
            self.assertEqual(response.status_code, 200)

    def test_switch_vault_preserves_old_index_without_leaking_context(self):
        self.note(); self.sync()
        second = Path(self.temp.name) / 'another-vault'
        second.mkdir()
        with patch.object(settings, 'obsidian_path', second):
            self.assertEqual(self.client.get('/api/obsidian/files').json()['file_count'], 0)
            self.sync()
            response = self.client.post('/api/companion/chat', json={'message': '职业方向'})
            self.assertNotIn('career.md', response.json()['analysis'])
        self.assertEqual(self.client.get('/api/obsidian/files').json()['file_count'], 1)

    def test_recent_fallback_is_explicit(self):
        self.note(text='# 音乐\n我喜欢钢琴。'); self.sync()
        response = self.client.post('/api/companion/chat', json={'message': 'What about gardening?'})
        self.assertIn('未匹配关键词', response.json()['analysis'])

    def test_pagination_and_timestamp_status(self):
        for index in range(3):
            self.note(str(index) + '.md')
        self.sync()
        page = self.client.get('/api/obsidian/files?offset=1&limit=1').json()
        self.assertEqual(page['total'], 3)
        self.assertEqual(len(page['items']), 1)
        self.assertEqual(page['last_sync_status'], 'ok')
        self.assertIsNotNone(page['last_sync_at'])
        self.assertEqual(self.client.get('/api/obsidian/files?limit=999').status_code, 422)

    def test_symlink_outside_vault_not_read(self):
        external = Path(self.temp.name) / 'private.md'
        external.write_text('not authorized', encoding='utf-8')
        try:
            os.symlink(str(external), str(self.vault / 'link.md'))
        except OSError:
            self.skipTest('Creating symlinks requires an OS permission not enabled on this machine')
        self.assertEqual(self.sync()['scanned'], 0)

    def test_link_filter_and_directory_scan_errors_are_conservative(self):
        self.note('link.md')
        with patch('app.integrations.obsidian.obsidian_reader.is_link', return_value=True):
            self.assertEqual(self.sync()['scanned'], 0)
        self.sync()
        def failed_walk(root, topdown, followlinks, onerror):
            onerror(PermissionError(13, 'Denied', root))
            return iter([])
        with patch('app.integrations.obsidian.obsidian_reader.os.walk', side_effect=failed_walk):
            result = self.sync()
        self.assertEqual(result['status'], 'partial')
        self.assertEqual(result['deleted'], 0)
        self.assertEqual(self.client.get('/api/obsidian/files').json()['file_count'], 1)


if __name__ == '__main__':
    unittest.main()
