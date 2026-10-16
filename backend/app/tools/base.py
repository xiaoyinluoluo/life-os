import hashlib
import json
from dataclasses import dataclass, field
from typing import Any, Dict, Optional, Type
from pydantic import BaseModel, ConfigDict, ValidationError
from sqlalchemy.orm import Session
from app.models.tool_execution import ToolProposal, ToolExecutionLog


class ToolError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message, self.status_code = message, status_code


class ToolInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


@dataclass
class ToolContext:
    session: Session
    profile_id: int = 1
    agent_name: str = 'companion'
    proposal_id: Optional[str] = None
    operation_index: Optional[int] = None
    references: Dict[str, int] = field(default_factory=dict)


def operations_hash(operations) -> str:
    return hashlib.sha256(json.dumps(operations, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()


def resolve_arguments(arguments: dict, references: dict) -> dict:
    resolved = {}
    for key, value in arguments.items():
        if value == '$created_project':
            if 'created_project' not in references:
                raise ToolError('项目引用尚未创建。', 409)
            value = references['created_project']
        resolved[key] = value
    return resolved


def audit(context: ToolContext, name: str, arguments: dict, output: dict, status: str):
    # Never include confirmation tokens in logs; caller owns the transaction.
    context.session.add(ToolExecutionLog(profile_id=context.profile_id, proposal_id=context.proposal_id,
        agent_name=context.agent_name, tool_name=name, input=arguments, output=output, execution_status=status))


class Tool:
    name: str
    description: str
    input_model: Type[BaseModel]
    requires_confirmation = False

    @property
    def parameters(self) -> dict:
        return self.input_model.model_json_schema()

    def descriptor(self) -> dict:
        return dict(name=self.name, description=self.description, parameters=self.parameters, requires_confirmation=self.requires_confirmation)

    def _authorize_write(self, context: ToolContext, values: dict):
        if context.proposal_id is None or context.operation_index is None:
            raise ToolError('写入工具必须先预览方案并经用户确认。', 403)
        # executing is uncommitted: only the confirmation transaction can see it.
        approval = context.session.get(ToolProposal, context.proposal_id)
        if approval is None or approval.profile_id != context.profile_id or approval.status != 'executing':
            raise ToolError('没有有效的执行授权。', 403)
        if approval.operations_hash != operations_hash(approval.operations):
            raise ToolError('方案内容已变化，原确认无效。', 409)
        index = context.operation_index
        if index != approval.next_operation or not 0 <= index < len(approval.operations):
            raise ToolError('工具执行顺序或授权范围不匹配。', 403)
        operation = approval.operations[index]
        expected = resolve_arguments(operation['arguments'], context.references)
        if operation['tool_name'] != self.name or self.input_model.model_validate(expected).model_dump(mode='json', exclude_unset=True) != values:
            raise ToolError('工具参数与用户确认的方案不一致。', 403)
        return approval

    def execute(self, context: ToolContext, arguments: dict) -> dict:
        try:
            values = self.input_model.model_validate(arguments).model_dump(mode='json', exclude_unset=True)
            approval = self._authorize_write(context, values) if self.requires_confirmation else None
            output = self._execute(context, self.input_model.model_validate(values))
            if approval is not None:
                approval.next_operation += 1
            audit(context, self.name, values, output, 'success')
            context.session.flush()
            return output
        except ValidationError:
            error = ToolError('工具参数不合法，请检查字段、日期与可选值。', 422)
        except ToolError as caught:
            error = caught
        audit(context, self.name, arguments, {'success': False, 'message': error.message}, 'denied' if error.status_code == 403 else 'failed')
        raise error

    def _execute(self, context: ToolContext, arguments: Any) -> dict:
        raise NotImplementedError
