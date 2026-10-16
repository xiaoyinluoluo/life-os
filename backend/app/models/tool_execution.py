from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Integer, JSON, String, Text
from app.models.base import Base


class ToolProposal(Base):
    __tablename__ = 'tool_proposals'
    id = Column(String(36), primary_key=True)
    profile_id = Column(Integer, nullable=False, index=True)
    agent_name = Column(String(80), nullable=False)
    status = Column(String(20), nullable=False, default='pending')
    confirmation_hash = Column(String(64), nullable=False)
    operations_hash = Column(String(64), nullable=False)
    operations = Column(JSON, nullable=False)
    analysis = Column(Text, nullable=False)
    summary = Column(Text, nullable=False)
    next_operation = Column(Integer, nullable=False, default=0)
    result = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime(timezone=True), nullable=False)


class ToolExecutionLog(Base):
    __tablename__ = 'tool_execution_logs'
    id = Column(Integer, primary_key=True)
    profile_id = Column(Integer, nullable=False, index=True)
    proposal_id = Column(String(36), nullable=True, index=True)
    agent_name = Column(String(80), nullable=False)
    tool_name = Column(String(80), nullable=False)
    input = Column(JSON, nullable=False)
    output = Column(JSON, nullable=False)
    execution_status = Column(String(30), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
