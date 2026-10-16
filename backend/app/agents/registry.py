from sqlalchemy.orm import Session
from app.agents.base import CompanionAgent
from app.agents.companion import LifeCompanionAgent
from app.services.ai.registry import get_model_client

def get_companion_agent(session: Session) -> CompanionAgent:
    return LifeCompanionAgent(session=session, model=get_model_client())
