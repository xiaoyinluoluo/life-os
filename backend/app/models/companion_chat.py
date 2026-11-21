from sqlalchemy import Column, Integer, JSON

from app.models.base import Base


class CompanionChat(Base):
    __tablename__ = 'companion_chat'

    id = Column(Integer, primary_key=True)
    revision = Column(Integer, nullable=False, default=0)
    turns = Column(JSON, nullable=False, default=list)
