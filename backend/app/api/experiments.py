"""User-owned decisions and their evidence, persisted in the existing database."""
from datetime import date, datetime
from typing import Literal
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models import WorkbenchRecord, Task
from app.services.database import get_session
from app.services.dashboard_demo import BUSINESS_TZ
from app.api.personal import owned_goal, task_project

router = APIRouter(prefix='/api/workbench/experiments', tags=['Decisions'])

class ExperimentInput(BaseModel):
    goal_id: int = Field(ge=1)
    choice: str = Field(min_length=1, max_length=2000)
    reconsider: str = Field(min_length=1, max_length=2000)
    evidence: str = Field(default='', max_length=4000)
    experiment: str = Field(default='', max_length=300)
    due_date: date | None = None
    request_id: str = Field(pattern=r'^[a-zA-Z0-9-]{1,64}$')

    @field_validator('choice', 'reconsider')
    @classmethod
    def nonempty(cls, value):
        if not value.strip():
            raise ValueError('请填写判断与改变主意的条件')
        return value.strip()

class ResolutionInput(BaseModel):
    result: str = Field(min_length=1, max_length=4000)
    outcome: Literal['continue', 'shrink', 'pause', 'finish']
    keep_insight: bool = False

class ScheduleInput(BaseModel):
    due_date: date | None = None

@router.post('/{item_id}/schedule')
def schedule(item_id: str, data: ScheduleInput, session: Session = Depends(get_session)):
    session.connection().exec_driver_sql('BEGIN IMMEDIATE')
    record = session.get(WorkbenchRecord, 'experiment:' + item_id)
    if not record:
        raise HTTPException(404, '决定不存在')
    if record.value['status'] != 'open':
        raise HTTPException(409, '这次验证已经结束')
    record.value = {**record.value, 'due_date': data.due_date.isoformat() if data.due_date else None}
    session.commit()
    return dict(id=item_id, **record.value)

@router.get('')
def listing(session: Session = Depends(get_session)):
    return [dict(id=row.key.removeprefix('experiment:'), **row.value) for row in session.scalars(
        select(WorkbenchRecord).where(WorkbenchRecord.key.startswith('experiment:')).order_by(WorkbenchRecord.key))]

@router.post('')
def create(data: ExperimentInput, session: Session = Depends(get_session)):
    session.connection().exec_driver_sql('BEGIN IMMEDIATE')
    key = 'experiment:' + data.request_id
    existing = session.get(WorkbenchRecord, key)
    if existing:
        return dict(id=data.request_id, **existing.value)
    goal = owned_goal(session, data.goal_id)
    if goal.is_demo or goal.status != 'active':
        raise HTTPException(409, '请选择进行中的个人目标')
    task_id = None
    if data.experiment.strip():
        project, _ = task_project(session, goal.id)
        task = Task(profile_id=1, project_id=project.id, title=data.experiment.strip(), due_date=data.due_date, is_demo=0)
        session.add(task)
        session.flush()
        task_id = task.id
    value = {**data.model_dump(mode='json', exclude={'request_id'}), 'goal_title': goal.title,
             'task_id': task_id, 'status': 'open', 'result': '', 'outcome': None,
             'created_at': datetime.now(BUSINESS_TZ).isoformat(), 'resolved_at': None, 'insight_id': None}
    session.add(WorkbenchRecord(key=key, value=value))
    session.commit()
    return dict(id=data.request_id, **value)

@router.post('/{item_id}/resolve')
def resolve(item_id: str, data: ResolutionInput, session: Session = Depends(get_session)):
    if not data.result.strip():
        raise HTTPException(422, '请记录观察到的结果')
    session.connection().exec_driver_sql('BEGIN IMMEDIATE')
    record = session.get(WorkbenchRecord, 'experiment:' + item_id)
    if not record:
        raise HTTPException(404, '决定不存在')
    if record.value['status'] == 'resolved':
        return dict(id=item_id, **record.value)
    goal = owned_goal(session, record.value['goal_id'])
    at = datetime.now(BUSINESS_TZ).isoformat()
    insight_id = uuid4().hex if data.keep_insight else None
    value = {**record.value, 'status': 'resolved', 'result': data.result.strip(),
             'outcome': data.outcome, 'resolved_at': at, 'insight_id': insight_id}
    record.value = value
    # This outcome concerns this experiment; goal status remains an explicit separate choice.
    goal.decisions = [*goal.decisions, {'status': goal.status, 'note': '验证后的选择：' +
        {'continue': '继续', 'shrink': '缩小范围', 'pause': '暂停验证', 'finish': '结束验证'}[data.outcome],
        'result': data.result.strip(), 'at': at}]
    if insight_id:
        session.add(WorkbenchRecord(key='insight:' + insight_id, value={
            'title': value['choice'][:200], 'body': f"原判断：{value['choice']}\n改变主意的条件：{value['reconsider']}\n依据：{value['evidence']}\n验证结果：{data.result.strip()}",
            'at': at, 'goal_id': goal.id, 'experiment_id': item_id}))
    session.commit()
    return dict(id=item_id, **value)
