import threading
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.integrations.obsidian.obsidian_reader import ObsidianReader
from app.models.source import Source, SourceRevision, VaultSync

sync_lock = threading.Lock()


class SyncBusy(Exception):
    pass


def record_revision(session: Session, source: Source, event: str, now: datetime):
    session.add(SourceRevision(source_id=source.id, event=event, content_hash=source.content_hash,
        summary=source.summary, tags=list(source.tags), created_at=source.created_at, updated_at=source.updated_at, recorded_at=now))


def sync_vault(session: Session, reader: ObsidianReader):
    if not sync_lock.acquire(blocking=False):
        raise SyncBusy('已有同步正在进行，请稍后重试。')
    try:
        scan = reader.scan()  # failure leaves the existing index intact
        now = datetime.now(timezone.utc)
        counts = dict(scanned=len(scan.notes), added=0, updated=0, restored=0, deleted=0, unchanged=0)
        # Serialize cross-process SQLite writers, including source history and sync status.
        session.connection().exec_driver_sql('BEGIN IMMEDIATE')
        existing = {source.file_path: source for source in session.scalars(select(Source).where(Source.vault_path == scan.vault_path))}
        seen = set()
        for note in scan.notes:
            seen.add(note.file_path)
            source = existing.get(note.file_path)
            if source is None:
                source = Source(vault_path=scan.vault_path, **note.__dict__, status='active', indexed_at=now)
                session.add(source)
                session.flush()
                event = 'added'
            elif source.status == 'deleted':
                event = 'restored'
            elif source.content_hash != note.content_hash or source.updated_at.replace(tzinfo=timezone.utc) != note.updated_at or source.created_at.replace(tzinfo=timezone.utc) != note.created_at:
                event = 'updated'
            else:
                counts['unchanged'] += 1
                continue
            for key, value in note.__dict__.items():
                setattr(source, key, value)
            source.status, source.indexed_at = 'active', now
            record_revision(session, source, event, now)
            counts[event] += 1
        # A partial scan must never mistake unreadable files for deleted files.
        if not scan.errors:
            for path, source in existing.items():
                if path not in seen and source.status == 'active':
                    source.status, source.indexed_at = 'deleted', now
                    record_revision(session, source, 'deleted', now)
                    counts['deleted'] += 1
        status = 'partial' if scan.errors else 'ok'
        session.add(VaultSync(vault_path=scan.vault_path, status=status, completed_at=now, counts=counts, errors=scan.errors))
        session.commit()
        return dict(vault_path=scan.vault_path, status=status, completed_at=now.isoformat(), errors=scan.errors, **counts)
    except Exception:
        session.rollback()
        raise
    finally:
        sync_lock.release()
