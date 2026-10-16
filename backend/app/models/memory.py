from datetime import datetime, timezone
from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Text
from app.models.base import Base


class Memory(Base):
    __tablename__ = 'memories'
    __table_args__ = (CheckConstraint("kind IN ('stage','status','review')"),)
    id = Column(Integer, primary_key=True)
    profile_id = Column(Integer, ForeignKey('user_profiles.id'), nullable=False, index=True)
    kind = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    is_demo = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
