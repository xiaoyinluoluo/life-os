from datetime import datetime, timezone
from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, JSON, String, Text
from app.models.base import Base


class Goal(Base):
    __tablename__ = 'goals'
    __table_args__ = (CheckConstraint("status IN ('active','completed','paused')"),)
    id = Column(Integer, primary_key=True)
    profile_id = Column(Integer, ForeignKey('user_profiles.id'), nullable=False, index=True)
    title = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default='active')
    outcome = Column(Text, nullable=False, default='', server_default='')
    decisions = Column(JSON, nullable=False, default=list, server_default='[]')
    is_demo = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
