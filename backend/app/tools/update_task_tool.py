from datetime import date, datetime, timezone
from typing import Literal, Optional
from pydantic import Field, model_validator
from app.models import Task
from app.tools.base import Tool, ToolContext, ToolInput, ToolError
from app.tools.task_tool import owned_project


class UpdateTaskInput(ToolInput):
    task_id: int = Field(ge=1)
    status: Optional[Literal['todo', 'in_progress', 'done']] = None
    priority: Optional[Literal['low', 'medium', 'high']] = None
    due_date: Optional[date] = None

    @model_validator(mode='after')
    def has_changes(self):
        changed = self.model_fields_set - {'task_id'}
        if not changed or any(getattr(self, key) is None for key in changed & {'status', 'priority'}):
            raise ValueError('Provide at least one non-null status/priority or a due_date (null clears the date)')
        return self


class UpdateTaskTool(Tool):
    name = 'update_task'
    description = '在用户确认后，修改一项任务的状态、优先级或截止日期。'
    input_model = UpdateTaskInput
    requires_confirmation = True

    def _execute(self, context: ToolContext, arguments: UpdateTaskInput):
        task = context.session.get(Task, arguments.task_id)
        if task is None or task.profile_id != context.profile_id:
            raise ToolError('任务不存在或不属于当前用户。', 404)
        owned_project(context, task.project_id)
        changes = arguments.model_dump(exclude_unset=True)
        for key in ('status', 'priority', 'due_date'):
            if key in changes:
                if key == 'status' and task.status != changes[key]:
                    task.completed_at = datetime.now(timezone.utc) if changes[key] == 'done' else None
                setattr(task, key, changes[key])
        return dict(success=True, task_id=task.id, status=task.status, priority=task.priority,
            due_date=task.due_date.isoformat() if task.due_date else None, message='任务已更新')
