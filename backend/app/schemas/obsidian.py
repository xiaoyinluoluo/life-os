from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, field_validator


class SourceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    file_name: str
    file_path: str
    content_hash: str
    summary: str
    tags: List[str]
    created_at: datetime
    updated_at: datetime
    indexed_at: datetime
    status: str

    @field_validator('created_at', 'updated_at', 'indexed_at')
    @classmethod
    def utc_date(cls, value):
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


class VaultFiles(BaseModel):
    vault_path: str
    connected: bool
    file_count: int
    deleted_count: int
    last_sync_at: Optional[str]
    last_sync_status: Optional[str]
    items: List[SourceRead]
    total: int
    offset: int
    limit: int


class ScanError(BaseModel):
    file_path: str
    reason: str


class SyncResult(BaseModel):
    vault_path: str
    status: str
    completed_at: str
    scanned: int
    added: int
    updated: int
    restored: int
    deleted: int
    unchanged: int
    errors: List[ScanError]
