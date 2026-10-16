from typing import Literal
from fastapi import APIRouter
from fastapi.responses import PlainTextResponse, JSONResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from app.core.config import settings
from app.services.database import engine

router = APIRouter(tags=['System'])

class HealthStatus(BaseModel):
    status: Literal['ok', 'degraded']
    application: str
    version: str
    database: Literal['connected', 'unavailable']
    ai_provider: str

@router.get('/', response_class=PlainTextResponse)
def root():
    return 'Life OS Backend Running'

@router.get('/health', response_model=HealthStatus, responses={503: {'model': HealthStatus}})
def health():
    try:
        with engine.connect() as connection:
            connection.execute(text('SELECT 1'))
        return HealthStatus(status='ok', application=settings.app_name, version=settings.version, database='connected', ai_provider=settings.ai_provider)
    except SQLAlchemyError:
        result = HealthStatus(status='degraded', application=settings.app_name, version=settings.version, database='unavailable', ai_provider=settings.ai_provider)
        return JSONResponse(status_code=503, content=result.model_dump())
