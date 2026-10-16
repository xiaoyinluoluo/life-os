from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.base import Base

engine = create_engine(URL.create('sqlite', database=str(settings.database_path)), connect_args={'check_same_thread': False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

def initialize_database():
    from app import models  # register model metadata
    settings.database_path.parent.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    from app.services.tool_schema import upgrade_tool_columns
    upgrade_tool_columns(engine)
    from app.services.profiles import seed_demo_profile
    with SessionLocal() as session:
        seed_demo_profile(session)

def get_session():
    with SessionLocal() as session:
        yield session
