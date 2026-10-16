from datetime import date, datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, field_validator


class GoalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    status: str
    is_demo: bool


class ProjectRead(GoalRead):
    goal_id: int


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    title: str
    status: str
    due_date: Optional[date]
    completed_at: Optional[datetime]
    is_demo: bool

    @field_validator('completed_at')
    @classmethod
    def utc_completion(cls, value):
        return value.replace(tzinfo=timezone.utc) if value and value.tzinfo is None else value


class MemoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    content: str
    created_at: datetime
    is_demo: bool

    @field_validator('created_at')
    @classmethod
    def utc_memory(cls, value):
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


class DashboardProfile(BaseModel):
    id: int
    name: str
    current_stage: str
    core_goal: str
    recent_status: str


class Progress(BaseModel):
    total: int
    completed: int
    percentage: int


class KnowledgeStatus(BaseModel):
    files_count: int
    last_sync: str
    connected: bool
    sync_status: Optional[str]


class Growth(BaseModel):
    completed_tasks: List[TaskRead]
    reviews: List[MemoryRead]


class DashboardResponse(BaseModel):
    profile: DashboardProfile
    goals: List[GoalRead]
    projects: List[ProjectRead]
    tasks: List[TaskRead]
    ai_insight: str
    ai_suggestions: List[str]
    ai_status: str
    ai_provider: str
    knowledge: KnowledgeStatus
    progress: Progress
    growth: Growth
    current_date: date
    timezone: str
    demo_data: bool
