from datetime import datetime, timezone
from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Text
from app.models.base import Base


class Goal(Base):
    __tablename__ = 'goals'
    __table_args__ = (CheckConstraint("status IN ('active','completed','paused')"),)
    id = Column(Integer, primary_key=True)
    profile_id = Column(Integer, ForeignKey('user_profiles.id'), nullable=False, index=True)
    title = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default='active')
    is_demo = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
