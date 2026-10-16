import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models import Goal, Project, Task, ToolExecutionLog
from app.services.database import get_session
from app.agents.registry import get_companion_agent
from app.schemas.tool_actions import PreviewRequest, ConfirmationRequest, CancelRequest, ToolCallRequest
from app.services.tool_actions import confirm_action, cancel_action, owned_proposal, public_proposal, utc
from app.tools.base import ToolContext, ToolError
from app.tools.registry import registry

router = APIRouter(tags=['Agent tools'])


@router.get('/api/tools')
def tools():
    return {'items': registry.available_tools()}


@router.get('/api/tools/logs')
def logs(limit: int = Query(50, ge=1, le=200), session: Session = Depends(get_session)):
    rows = session.scalars(select(ToolExecutionLog).where(ToolExecutionLog.profile_id == 1).order_by(ToolExecutionLog.id.desc()).limit(limit)).all()
    return {'items': [dict(id=row.id, agent_name=row.agent_name, tool_name=row.tool_name, input=row.input, output=row.output,
        execution_status=row.execution_status, created_at=utc(row.created_at).isoformat(), proposal_id=row.proposal_id) for row in rows]}


@router.post('/api/tools/{tool_name}/execute')
def execute_read_tool(tool_name: str, request: ToolCallRequest, session: Session = Depends(get_session)):
    # No confirmation context is accepted from the client. Generic writes are denied.
    try:
        output = registry.execute(tool_name, request.arguments, ToolContext(session=session))
        session.commit()
        return output
    except ToolError as error:
        session.commit()
        raise HTTPException(error.status_code, error.message)


@router.get('/api/companion/goals')
def goals(session: Session = Depends(get_session)):
    rows = session.scalars(select(Goal).where(Goal.profile_id == 1, Goal.status == 'active').order_by(Goal.id)).all()
    return {'items': [dict(id=row.id, title=row.title) for row in rows]}


@router.post('/api/companion/actions/preview')
async def preview(request: PreviewRequest, session: Session = Depends(get_session)):
    try:
        return await asyncio.wait_for(get_companion_agent(session).propose_action(request), timeout=30)
    except ToolError as error:
        session.commit()
        raise HTTPException(error.status_code, error.message)
    except ValidationError:
        session.rollback()
        raise HTTPException(502, '模型建议格式异常，未创建执行方案。')
    except asyncio.TimeoutError:
        session.rollback()
        raise HTTPException(504, '方案生成超时，未执行任何操作。')


@router.get('/api/companion/actions/{proposal_id}')
def action(proposal_id: str, session: Session = Depends(get_session)):
    try:
        proposal = owned_proposal(session, proposal_id)
        result = public_proposal(proposal)
        if proposal.status == 'executed':
            project_id = (proposal.result or {}).get('project_id')
            project = session.get(Project, project_id) if project_id else None
            result['project'] = dict(id=project.id, title=project.title, description=project.description, goal_id=project.goal_id) if project and project.profile_id == 1 else None
            ids = (proposal.result or {}).get('task_ids', [])
            rows = session.scalars(select(Task).where(Task.profile_id == 1, Task.id.in_(ids)).order_by(Task.id)).all() if ids else []
            result['tasks'] = [dict(id=row.id, title=row.title, description=row.description, priority=row.priority, status=row.status, due_date=row.due_date.isoformat() if row.due_date else None) for row in rows]
        return result
    except ToolError as error:
        raise HTTPException(error.status_code, error.message)


@router.post('/api/companion/actions/{proposal_id}/confirm')
def confirm(proposal_id: str, request: ConfirmationRequest, session: Session = Depends(get_session)):
    try:
        return confirm_action(session, proposal_id, request)
    except ToolError as error:
        raise HTTPException(error.status_code, error.message)


@router.post('/api/companion/actions/{proposal_id}/cancel')
def cancel(proposal_id: str, request: CancelRequest, session: Session = Depends(get_session)):
    try:
        return cancel_action(session, proposal_id, request.confirmation_token)
    except ToolError as error:
        session.rollback()
        raise HTTPException(error.status_code, error.message)
