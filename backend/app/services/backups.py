"""Consistent local SQLite snapshots. Never includes .env or Vault files."""
import sqlite3
from contextlib import closing
from datetime import datetime
from app.core.config import settings


def backup_database(daily=False):
    source = settings.database_path
    if not source.exists():
        return None
    directory = source.parent / 'backups'
    directory.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime('%Y%m%d' if daily else '%Y%m%d-%H%M%S-%f')
    target = directory / f'life-os-{stamp}.db'
    if daily and target.exists():
        return target
    try:
        with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as src, closing(sqlite3.connect(target)) as dst:
            src.backup(dst)
            if dst.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise RuntimeError('备份完整性检查失败')
    except Exception:
        target.unlink(missing_ok=True)
        raise
    return target
