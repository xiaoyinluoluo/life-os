from app.core.config import settings
from app.services.ai.base import ModelClient
from app.services.ai.mock import MockModelClient


def get_model_client() -> ModelClient:
    if settings.ai_provider != 'mock':
        raise ValueError('Only mock is implemented. Add a ModelClient adapter before selecting another provider.')
    return MockModelClient()
