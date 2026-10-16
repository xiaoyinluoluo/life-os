import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy.orm import Session
from app.agents.registry import get_companion_agent
from app.schemas.companion import ChatRequest, CompanionResult
from app.services.database import get_session
from app.services.profiles import ProfileNotFound
from app.tools.base import ToolError

router = APIRouter(prefix='/api/companion', tags=['Companion'])
logger = logging.getLogger(__name__)


@router.post('/chat', response_model=CompanionResult)
async def chat(payload: ChatRequest, session: Session = Depends(get_session)):
    agent = get_companion_agent(session)
    try:
        return await asyncio.wait_for(agent.respond(payload.message), timeout=30)
    except ProfileNotFound:
        raise HTTPException(status_code=404, detail='用户档案不存在，请重新启动后端初始化演示档案。')
    except ToolError as error:
        session.commit()
        raise HTTPException(status_code=error.status_code, detail=error.message)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail='伙伴响应超时，请稍后再试。')
    except ValidationError:
        logger.error('Companion model returned an invalid response shape')
        raise HTTPException(status_code=502, detail='模型返回格式不正确，请稍后再试。')
