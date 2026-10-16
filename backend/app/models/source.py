from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from app.models.base import Base


class Source(Base):
    __tablename__ = 'sources'
    __table_args__ = (UniqueConstraint('vault_path', 'file_path', name='uq_vault_file'),)
    id = Column(Integer, primary_key=True)
    vault_path = Column(Text, nullable=False, index=True)
    file_name = Column(Text, nullable=False)
    file_path = Column(Text, nullable=False)
    content_hash = Column(String(64), nullable=False)
    summary = Column(Text, nullable=False)
    tags = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), nullable=False, default='active')
    indexed_at = Column(DateTime(timezone=True), nullable=False)


class SourceRevision(Base):
    __tablename__ = 'source_revisions'
    id = Column(Integer, primary_key=True)
    source_id = Column(Integer, ForeignKey('sources.id'), nullable=False, index=True)
    event = Column(String(20), nullable=False)
    content_hash = Column(String(64), nullable=False)
    summary = Column(Text, nullable=False)
    tags = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)
    recorded_at = Column(DateTime(timezone=True), nullable=False)


class VaultSync(Base):
    __tablename__ = 'vault_syncs'
    id = Column(Integer, primary_key=True)
    vault_path = Column(Text, nullable=False, index=True)
    status = Column(String(20), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=False)
    counts = Column(JSON, nullable=False)
    errors = Column(JSON, nullable=False)
