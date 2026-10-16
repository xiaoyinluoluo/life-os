from pydantic import Field
from app.models import Goal, Project
from app.tools.base import Tool, ToolContext, ToolInput, ToolError


class ProjectInput(ToolInput):
    goal_id: int = Field(ge=1)
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default='', max_length=4000)


class CreateProjectTool(Tool):
    name = 'create_project'
    description = '在用户确认后，为当前用户的有效目标创建项目。'
    input_model = ProjectInput
    requires_confirmation = True

    def _execute(self, context: ToolContext, arguments: ProjectInput):
        goal = context.session.get(Goal, arguments.goal_id)
        if goal is None or goal.profile_id != context.profile_id:
            raise ToolError('目标不存在或不属于当前用户。', 404)
        if goal.status != 'active':
            raise ToolError('目标当前不可用，请选择进行中的目标。', 409)
        project = Project(profile_id=context.profile_id, goal_id=goal.id, title=arguments.title, description=arguments.description, is_demo=0)
        context.session.add(project); context.session.flush()
        return dict(success=True, project_id=project.id, message='项目已创建')
