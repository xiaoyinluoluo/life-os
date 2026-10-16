from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.system import router
from app.core.config import settings
from app.services.database import initialize_database, engine
from app.services.ai.registry import get_model_client
from app.api.companion import router as companion_router
from app.api.obsidian import router as obsidian_router
from app.api.dashboard import router as dashboard_router
from app.api.tool_actions import router as tool_router
from app.services.dashboard_demo import seed_dashboard_demo
from app.services.database import SessionLocal

@asynccontextmanager
async def lifespan(app):
    get_model_client()  # validate configured provider; no model calls
    initialize_database()
    with SessionLocal() as session:
        seed_dashboard_demo(session)
    try:
        yield
    finally:
        engine.dispose()

app = FastAPI(title=settings.app_name, version=settings.version, lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=['GET', 'POST'], allow_headers=['Content-Type'])
app.include_router(router)
app.include_router(companion_router)
app.include_router(obsidian_router)
app.include_router(dashboard_router)
app.include_router(tool_router)
