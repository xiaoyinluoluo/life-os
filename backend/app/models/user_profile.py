from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Integer, JSON, String, Text
from app.models.base import Base


class UserProfile(Base):
    __tablename__ = 'user_profiles'

    id = Column(Integer, primary_key=True)
    name = Column(String(80), nullable=False)
    background = Column(Text, nullable=False, default='')
    skills = Column(JSON, nullable=False, default=list)
    interests = Column(JSON, nullable=False, default=list)
    values = Column(JSON, nullable=False, default=list)
    goals = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
