from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.schemas.dashboard import DashboardResponse
from app.services.database import get_session
from app.services.dashboard_service import get_dashboard
from app.services.profiles import ProfileNotFound

router = APIRouter(tags=['Dashboard'])


@router.get('/api/dashboard', response_model=DashboardResponse)
async def dashboard(session: Session = Depends(get_session)):
    try:
        return await get_dashboard(session)
    except ProfileNotFound:
        raise HTTPException(404, '用户档案不存在，请启动后端初始化演示档案。')
