"""Fictional display data. Never overwrite an existing planning or memory record."""
import json
from datetime import datetime, time, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.config import BACKEND_DIR
from app.models import Goal, Project, Task, Memory, UserProfile
from app.services.profiles import DEMO_PROFILE_ID

BUSINESS_TZ = timezone(timedelta(hours=8))


def seed_dashboard_demo(session: Session, today=None):
    if session.get(UserProfile, DEMO_PROFILE_ID) is None:
        return
    for model in (Goal, Project, Task, Memory):
        if session.scalar(select(model.id).where(model.profile_id == DEMO_PROFILE_ID).limit(1)) is not None:
            return
    today = today or datetime.now(BUSINESS_TZ).date()
    data = json.loads((BACKEND_DIR / 'data' / 'demo_dashboard.json').read_text(encoding='utf-8'))
    goals, projects = {}, {}
    for item in data['goals']:
        goal = Goal(profile_id=DEMO_PROFILE_ID, title=item['title'], status='active', is_demo=1)
        session.add(goal); session.flush()
        goals[item['key']] = goal.id
    for item in data['projects']:
        project = Project(profile_id=DEMO_PROFILE_ID, goal_id=goals[item['goal']], title=item['title'], status='active', is_demo=1)
        session.add(project); session.flush()
        projects[item['key']] = project.id
    for item in data['tasks']:
        day = today + timedelta(days=item['due_offset'])
        completed = datetime.combine(day, time(9), BUSINESS_TZ).astimezone(timezone.utc) if item['status'] == 'done' else None
        session.add(Task(profile_id=DEMO_PROFILE_ID, project_id=projects[item['project']], title=item['title'], status=item['status'], due_date=day, completed_at=completed, is_demo=1))
    for item in data['memories']:
        day = today - timedelta(days=item['days_ago'])
        session.add(Memory(profile_id=DEMO_PROFILE_ID, kind=item['kind'], content=item['content'], is_demo=1,
            created_at=datetime.combine(day, time(8), BUSINESS_TZ).astimezone(timezone.utc)))
    session.commit()
