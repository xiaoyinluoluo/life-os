from datetime import timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from app.core.config import settings
from app.integrations.obsidian.obsidian_reader import ObsidianReader, VaultUnavailable, canonical_path
from app.models.source import Source, VaultSync
from app.schemas.obsidian import SourceRead, VaultFiles, SyncResult
from app.services.database import get_session
from app.services.sync_service import sync_vault, SyncBusy

router = APIRouter(prefix='/api/obsidian', tags=['Obsidian'])


@router.get('/files', response_model=VaultFiles)
def files(include_deleted: bool = False, offset: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=200), session: Session = Depends(get_session)):
    vault = canonical_path(settings.obsidian_path)
    base = select(Source).where(Source.vault_path == vault)
    active = session.scalar(select(func.count()).select_from(Source).where(Source.vault_path == vault, Source.status == 'active'))
    deleted = session.scalar(select(func.count()).select_from(Source).where(Source.vault_path == vault, Source.status == 'deleted'))
    if not include_deleted:
        base = base.where(Source.status == 'active')
    total = session.scalar(select(func.count()).select_from(base.subquery()))
    items = session.scalars(base.order_by(Source.file_path).offset(offset).limit(limit)).all()
    latest = session.scalar(select(VaultSync).where(VaultSync.vault_path == vault).order_by(VaultSync.id.desc()).limit(1))
    return dict(vault_path=vault, connected=settings.obsidian_path.is_dir(), file_count=active, deleted_count=deleted, items=[SourceRead.model_validate(item) for item in items], total=total, offset=offset, limit=limit,
        last_sync_at=latest.completed_at.replace(tzinfo=timezone.utc).isoformat() if latest else None, last_sync_status=latest.status if latest else None)


@router.post('/sync', response_model=SyncResult)
def sync(session: Session = Depends(get_session)):
    try:
        return sync_vault(session, ObsidianReader(settings.obsidian_path, settings.obsidian_max_file_bytes))
    except VaultUnavailable as error:
        raise HTTPException(400, str(error))
    except SyncBusy as error:
        raise HTTPException(409, str(error))
    except OperationalError:
        raise HTTPException(503, '索引数据库暂时忙，请稍后重试。')
