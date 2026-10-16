from datetime import date
from typing import Literal, Optional
from pydantic import Field
from app.models import Goal, Project, Task
from app.tools.base import Tool, ToolContext, ToolInput, ToolError


def owned_project(context, project_id):
    project = context.session.get(Project, project_id)
    goal = context.session.get(Goal, project.goal_id) if project else None
    if project is None or goal is None or project.profile_id != context.profile_id or goal.profile_id != context.profile_id:
        raise ToolError('项目不存在或不属于当前用户。', 404)
    return project


class TaskInput(ToolInput):
    project_id: int = Field(ge=1)
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default='', max_length=4000)
    priority: Literal['low', 'medium', 'high'] = 'medium'
    due_date: Optional[date] = None


class CreateTaskTool(Tool):
    name = 'create_task'
    description = '在用户确认后，为当前用户的项目创建一项任务。'
    input_model = TaskInput
    requires_confirmation = True

    def _execute(self, context: ToolContext, arguments: TaskInput):
        project = owned_project(context, arguments.project_id)
        if project.status != 'active':
            raise ToolError('项目当前不可用。', 409)
        task = Task(profile_id=context.profile_id, project_id=project.id, title=arguments.title, description=arguments.description,
            priority=arguments.priority, due_date=arguments.due_date, status='todo', is_demo=0)
        context.session.add(task); context.session.flush()
        return dict(success=True, task_id=task.id, project_id=project.id, message='任务已创建')
