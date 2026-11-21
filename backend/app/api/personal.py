from datetime import date, datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Goal, Project, Task, UserProfile
from app.services.database import get_session
from app.services.dashboard_demo import BUSINESS_TZ

router = APIRouter(prefix='/api/personal', tags=['Personal'])

class ProfileInput(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    background: str = Field(default='', max_length=4000)
    skills: list[str] = Field(default_factory=list, max_length=50)
    interests: list[str] = Field(default_factory=list, max_length=50)
    values: list[str] = Field(default_factory=list, max_length=50)
    goals: list[str] = Field(default_factory=list, max_length=50)

    @field_validator('name')
    @classmethod
    def validate_name(cls, value):
        value = value.strip()
        if not value:
            raise ValueError('姓名不能为空')
        return value

class TaskInput(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    due_date: date | None = None
    goal_id: int | None = Field(default=None, ge=1)
    source_key: str | None = Field(default=None, max_length=100, pattern=r'^[a-zA-Z0-9:_-]+$')

    @field_validator('title')
    @classmethod
    def validate_title(cls, value):
        value = value.strip()
        if not value:
            raise ValueError('任务不能为空')
        return value

class TaskStatus(BaseModel):
    status: Literal['todo', 'in_progress', 'done']

class ReviewInput(BaseModel):
    review: str = Field(max_length=2000)

class GoalInput(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    outcome: str = Field(default='', max_length=2000)

    @field_validator('title')
    @classmethod
    def validate_title(cls, value):
        if not value.strip():
            raise ValueError('目标名称不能为空')
        return value.strip()

class GoalDecisionInput(BaseModel):
    status: Literal['active', 'paused', 'completed']
    note: str = Field(min_length=1, max_length=2000)
    result: str = Field(default='', max_length=2000)

class OrganizeInput(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=200)
    action: Literal['today', 'unschedule', 'archive', 'restore', 'focus', 'unfocus']

class WorkspaceInput(BaseModel):
    mode: Literal['personal', 'demo']
    name: str = Field(default='', max_length=80)

@router.get('/workspace')
def get_workspace(session: Session = Depends(get_session)):
    profile = session.get(UserProfile, 1)
    return {'mode': profile.workspace_mode, 'name': profile.name}

@router.post('/workspace')
def set_workspace(data: WorkspaceInput, session: Session = Depends(get_session)):
    profile = session.get(UserProfile, 1)
    if data.mode == 'personal' and not data.name.strip():
        raise HTTPException(422, '请填写称呼')
    if data.mode == 'personal':
        # Only replace the untouched fixture. Preserve any profile already edited.
        from app.core.config import BACKEND_DIR
        import json
        fixture = json.loads((BACKEND_DIR / 'data' / 'demo_profile.json').read_text(encoding='utf-8'))
        for key in ('background', 'skills', 'interests', 'values', 'goals'):
            if getattr(profile, key) == fixture.get(key):
                setattr(profile, key, '' if key == 'background' else [])
        profile.name = data.name.strip()
    profile.workspace_mode = data.mode
    session.commit()
    return {'mode': profile.workspace_mode, 'name': profile.name}

def goal_data(goal):
    return {
        'id': goal.id, 'title': goal.title, 'status': goal.status, 'outcome': goal.outcome,
        'decisions': goal.decisions, 'is_demo': bool(goal.is_demo),
    }

def task_data(task, goal):
    return {
        'id': task.id, 'title': task.title, 'status': task.status, 'due_date': task.due_date,
        'is_demo': bool(task.is_demo), 'review': task.review, 'project_id': task.project_id,
        'goal_id': goal.id, 'goal_title': goal.title, 'goal_status': goal.status,
        'focus_date': task.focus_date, 'archived': task.archived,
    }

def task_goal(session, task):
    return session.get(Goal, session.get(Project, task.project_id).goal_id)

def owned_goal(session, goal_id):
    goal = session.get(Goal, goal_id)
    if not goal or goal.profile_id != 1:
        raise HTTPException(404, '目标不存在')
    return goal

def task_project(session, goal_id):
    if goal_id is not None:
        goal = owned_goal(session, goal_id)
        if goal.status != 'active' or goal.is_demo:
            raise HTTPException(409, '请选择进行中的个人目标')
    else:
        goal = session.scalar(select(Goal).where(
            Goal.profile_id == 1, Goal.title == '日常生活', Goal.is_demo == 0, Goal.status == 'active',
        ).order_by(Goal.id))
        if not goal:
            goal = Goal(profile_id=1, title='日常生活', is_demo=0)
            session.add(goal)
            session.flush()
    project = session.scalar(select(Project).where(
        Project.profile_id == 1, Project.goal_id == goal.id,
        Project.title == '日常任务', Project.is_demo == 0, Project.status == 'active',
    ).order_by(Project.id))
    if not project:
        project = Project(profile_id=1, goal_id=goal.id, title='日常任务', is_demo=0)
        session.add(project)
        session.flush()
    return project, goal

@router.get('/goals')
def get_goals(session: Session = Depends(get_session)):
    query = select(Goal).where(Goal.profile_id == 1)
    if session.get(UserProfile, 1).workspace_mode == 'personal':
        query = query.where(Goal.is_demo == 0)
    return [goal_data(goal) for goal in session.scalars(query.order_by(Goal.id))]

@router.post('/goals')
def add_goal(data: GoalInput, session: Session = Depends(get_session)):
    goal = Goal(profile_id=1, title=data.title, outcome=data.outcome.strip(), is_demo=0)
    session.add(goal)
    session.commit()
    return goal_data(goal)

@router.post('/goals/{goal_id}/edit')
def edit_goal(goal_id: int, data: GoalInput, session: Session = Depends(get_session)):
    goal = owned_goal(session, goal_id)
    goal.title = data.title
    goal.outcome = data.outcome.strip()
    session.commit()
    return goal_data(goal)

@router.post('/goals/{goal_id}/decisions')
def add_decision(goal_id: int, data: GoalDecisionInput, session: Session = Depends(get_session)):
    note = data.note.strip()
    if not note:
        raise HTTPException(422, '请记录这次决定的原因')
    session.connection().exec_driver_sql('BEGIN IMMEDIATE')
    goal = owned_goal(session, goal_id)
    goal.status = data.status
    goal.decisions = [*goal.decisions, {
        'status': data.status, 'note': note, 'result': data.result.strip(),
        'at': datetime.now(timezone.utc).isoformat(),
    }]
    if data.status != 'active':
        tasks = select(Task).join(Project, Task.project_id == Project.id).where(
            Task.profile_id == 1, Project.profile_id == 1, Project.goal_id == goal.id,
            Task.focus_date.is_not(None),
        )
        for task in session.scalars(tasks):
            task.focus_date = None
    session.commit()
    return goal_data(goal)

@router.get('/profile')
def get_profile(session: Session = Depends(get_session)):
    profile = session.get(UserProfile, 1)
    if not profile:
        raise HTTPException(404, '档案不存在')
    return {key: getattr(profile, key) for key in ('name', 'background', 'skills', 'interests', 'values', 'goals')}

@router.post('/profile')
def save_profile(data: ProfileInput, session: Session = Depends(get_session)):
    profile = session.get(UserProfile, 1)
    if not profile:
        raise HTTPException(404, '档案不存在')
    for key, value in data.model_dump().items():
        setattr(profile, key, value)
    session.commit()
    return {'ok': True}

@router.get('/tasks')
def get_tasks(session: Session = Depends(get_session)):
    query = select(Task, Goal).join(Project, Task.project_id == Project.id).join(
        Goal, Project.goal_id == Goal.id,
    ).where(Task.profile_id == 1, Project.profile_id == 1, Goal.profile_id == 1)
    if session.get(UserProfile, 1).workspace_mode == 'personal':
        query = query.where(Task.is_demo == 0)
    return [task_data(task, goal) for task, goal in session.execute(query.order_by(Task.created_at.desc(), Task.id.desc()))]

@router.post('/tasks')
def add_task(data: TaskInput, session: Session = Depends(get_session)):
    session.connection().exec_driver_sql('BEGIN IMMEDIATE')
    from app.models import WorkbenchRecord
    key = 'action:' + data.source_key if data.source_key else None
    existing = session.get(WorkbenchRecord, key) if key else None
    if existing:
        task = session.get(Task, existing.value['task_id'])
        if task and task.profile_id == 1:
            return task_data(task, task_goal(session, task))
    project, goal = task_project(session, data.goal_id)
    task = Task(profile_id=1, project_id=project.id, title=data.title, due_date=data.due_date, is_demo=0)
    session.add(task)
    session.flush()
    if key:
        session.add(WorkbenchRecord(key=key, value={'task_id': task.id}))
    session.commit()
    session.refresh(task)
    return task_data(task, goal)

@router.post('/tasks/organize')
def organize_tasks(data: OrganizeInput, session: Session = Depends(get_session)):
    session.connection().exec_driver_sql('BEGIN IMMEDIATE')
    today = datetime.now(BUSINESS_TZ).date()
    query = select(Task, Goal).join(Project, Task.project_id == Project.id).join(
        Goal, Project.goal_id == Goal.id,
    ).where(Task.id.in_(data.ids), Task.profile_id == 1, Project.profile_id == 1, Goal.profile_id == 1)
    rows = session.execute(query).all()
    if len(rows) != len(set(data.ids)):
        raise HTTPException(404, '部分任务已不存在，请刷新重试')
    if data.action in ('today', 'unschedule', 'focus') and any(
        task.archived or task.status == 'done' or goal.status != 'active' for task, goal in rows
    ):
        raise HTTPException(409, '只能安排尚未完成且目标进行中的任务')
    if data.action == 'focus':
        existing = set(session.scalars(select(Task.id).where(
            Task.profile_id == 1, Task.focus_date == today, Task.archived.is_(False),
        )))
        if len(existing | set(data.ids)) > 2:
            raise HTTPException(409, '今天已有两项重点，请先取消其中一项')
    for task, _ in rows:
        if data.action == 'archive':
            task.archived = True
            task.focus_date = None
        elif data.action == 'restore':
            task.archived = False
        elif data.action == 'focus':
            task.focus_date = today
        elif data.action == 'unfocus':
            task.focus_date = None
        else:
            task.due_date = today if data.action == 'today' else None
            if data.action == 'unschedule':
                task.focus_date = None
    session.commit()
    return [task_data(task, goal) for task, goal in rows]

@router.post('/tasks/{task_id}/status')
def set_task_status(task_id: int, data: TaskStatus, session: Session = Depends(get_session)):
    task = session.get(Task, task_id)
    if not task or task.profile_id != 1:
        raise HTTPException(404, '任务不存在')
    if task.status != data.status:
        task.completed_at = datetime.now(timezone.utc) if data.status == 'done' else None
    task.status = data.status
    session.commit()
    return task_data(task, task_goal(session, task))

@router.post('/tasks/{task_id}/edit')
def edit_task(task_id: int, data: TaskInput, session: Session = Depends(get_session)):
    session.connection().exec_driver_sql('BEGIN IMMEDIATE')
    task = session.get(Task, task_id)
    if not task or task.profile_id != 1:
        raise HTTPException(404, '任务不存在')
    task.title = data.title
    task.due_date = data.due_date
    goal = task_goal(session, task)
    if 'goal_id' in data.model_fields_set and data.goal_id != goal.id:
        project, goal = task_project(session, data.goal_id)
        task.project_id = project.id
    session.commit()
    return task_data(task, goal)

@router.post('/tasks/{task_id}/review')
def save_review(task_id: int, data: ReviewInput, session: Session = Depends(get_session)):
    task = session.get(Task, task_id)
    if not task or task.profile_id != 1:
        raise HTTPException(404, '任务不存在')
    task.review = data.review.strip()
    session.commit()
    return task_data(task, task_goal(session, task))
