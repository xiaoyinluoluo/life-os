from typing import Dict, Any, Literal, Optional
from pydantic import Field, StrictBool, model_validator
from app.tools.base import ToolInput
from app.tools.update_task_tool import UpdateTaskInput


class PreviewRequest(ToolInput):
    message: str = Field(min_length=1, max_length=4000)
    action_type: Literal['create_plan', 'update_task'] = 'create_plan'
    goal_id: Optional[int] = Field(default=None, ge=1)
    task_id: Optional[int] = Field(default=None, ge=1)
    changes: Dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode='after')
    def valid_action(self):
        if self.action_type == 'create_plan':
            if self.goal_id is None or self.task_id is not None or self.changes:
                raise ValueError('create_plan requires goal_id only')
        else:
            if self.task_id is None or self.goal_id is not None or 'task_id' in self.changes:
                raise ValueError('update_task requires task_id and changes')
            UpdateTaskInput.model_validate(dict(task_id=self.task_id, **self.changes))
        return self


class ConfirmationRequest(ToolInput):
    confirmation_token: str = Field(min_length=20, max_length=128)
    confirmed: StrictBool = False


class CancelRequest(ToolInput):
    confirmation_token: str = Field(min_length=20, max_length=128)


class ToolCallRequest(ToolInput):
    arguments: Dict[str, Any] = Field(default_factory=dict)
