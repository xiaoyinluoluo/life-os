from datetime import datetime, timezone
from sqlalchemy import CheckConstraint, Column, Date, DateTime, ForeignKey, Integer, String, Text
from app.models.base import Base


class Task(Base):
    __tablename__ = 'tasks'
    __table_args__ = (CheckConstraint("status IN ('todo','in_progress','done')"),)
    id = Column(Integer, primary_key=True)
    profile_id = Column(Integer, ForeignKey('user_profiles.id'), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'), nullable=False)
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=False, default='', server_default='')
    priority = Column(String(20), nullable=False, default='medium', server_default='medium')
    status = Column(String(20), nullable=False, default='todo')
    due_date = Column(Date, nullable=True, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    is_demo = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
