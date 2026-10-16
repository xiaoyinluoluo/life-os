from sqlalchemy import Column, Integer, String
from app.models.base import Base

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    display_name = Column(String(80), nullable=False)
