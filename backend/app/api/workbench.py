from datetime import datetime, timedelta, date
from pathlib import Path
from uuid import uuid4
from sqlalchemy import select
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.models import WorkbenchRecord
from app.services.database import get_session
from app.services.dashboard_demo import BUSINESS_TZ
from app.services.backups import backup_database
from app.core.config import settings
from app.api.personal import get_tasks, get_goals

router = APIRouter(prefix='/api/workbench', tags=['Workbench'])

class DayInput(BaseModel):
    minutes: int = Field(ge=0, le=1440)
    estimates: dict[str, int] = Field(default_factory=dict, max_length=1000)

class ReflectionInput(BaseModel):
    result: str = Field(default='', max_length=4000)
    obstacle: str = Field(default='', max_length=4000)
    adjustment: str = Field(default='', max_length=4000)

class InsightInput(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=8000)

@router.get('/insights')
def insights(session: Session = Depends(get_session)):
    return [{'id': row.key.split(':')[1], **row.value} for row in session.scalars(
        select(WorkbenchRecord).where(WorkbenchRecord.key.startswith('insight:')).order_by(WorkbenchRecord.key))]

@router.post('/insights')
def save_insight(data: InsightInput, session: Session = Depends(get_session)):
    if not data.title.strip() or not data.body.strip():
        raise HTTPException(422, '标题和内容不能为空')
    key = uuid4().hex
    write(session, 'insight:' + key, {**data.model_dump(), 'at': datetime.now(BUSINESS_TZ).isoformat()})
    return {'id': key}

def read(session, key, default):
    record = session.get(WorkbenchRecord, key)
    return record.value if record else default

def write(session, key, value):
    record = session.get(WorkbenchRecord, key)
    if record:
        record.value = value
    else:
        session.add(WorkbenchRecord(key=key, value=value))
    session.commit()
    return value

def today():
    return datetime.now(BUSINESS_TZ).date()

@router.get('/day')
def day(session: Session = Depends(get_session)):
    return read(session, 'day:' + today().isoformat(), {'minutes': 120, 'estimates': {}})

@router.post('/day')
def save_day(data: DayInput, session: Session = Depends(get_session)):
    if any(not key.isdigit() or value < 1 or value > 1440 for key, value in data.estimates.items()):
        raise HTTPException(422, '预计用时应为 1–1440 分钟')
    return write(session, 'day:' + today().isoformat(), data.model_dump())

@router.get('/week')
def week(session: Session = Depends(get_session)):
    start = today() - timedelta(days=today().weekday())
    end = start + timedelta(days=7)
    tasks = get_tasks(session)
    # Completed date is read from the model rather than inferred from the due date.
    from app.models import Task
    completed = []
    for item in tasks:
        task = session.get(Task, item['id'])
        if task.status == 'done' and task.completed_at:
            at = task.completed_at
            if at.tzinfo is None:
                from datetime import timezone
                at = at.replace(tzinfo=timezone.utc)
            if start <= at.astimezone(BUSINESS_TZ).date() < end:
                completed.append(item)
    return {'start': start, 'end': end - timedelta(days=1), 'completed': completed,
            'overdue': [t for t in tasks if not t['archived'] and t['status'] != 'done'
                        and t['goal_status'] == 'active' and t['due_date'] and t['due_date'] < today()],
            'goals': get_goals(session),
            'reflection': read(session, 'week:' + start.isoformat(), {'result': '', 'obstacle': '', 'adjustment': ''})}

@router.post('/week')
def save_week(data: ReflectionInput, session: Session = Depends(get_session)):
    start = today() - timedelta(days=today().weekday())
    return write(session, 'week:' + start.isoformat(), data.model_dump())

@router.get('/backups')
def backups():
    directory = settings.database_path.parent / 'backups'
    return [{'name': p.name, 'bytes': p.stat().st_size} for p in sorted(directory.glob('life-os-*.db'), reverse=True)]

@router.post('/backups')
def create_backup():
    path = backup_database()
    if not path:
        raise HTTPException(409, '数据库尚未创建')
    return {'name': path.name}

@router.get('/backups/{name}')
def download_backup(name: str):
    if Path(name).name != name or not name.startswith('life-os-') or not name.endswith('.db'):
        raise HTTPException(404, '备份不存在')
    path = settings.database_path.parent / 'backups' / name
    if not path.is_file():
        raise HTTPException(404, '备份不存在')
    return FileResponse(path, filename=name, media_type='application/octet-stream')
