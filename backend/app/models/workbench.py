from sqlalchemy import Column, String, JSON
from app.models.base import Base


class WorkbenchRecord(Base):
    __tablename__ = 'workbench_records'
    key = Column(String(100), primary_key=True)
    value = Column(JSON, nullable=False, default=dict)
