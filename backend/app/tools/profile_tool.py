from app.models import UserProfile
from app.schemas.companion import ProfileData
from app.tools.base import Tool, ToolContext, ToolInput, ToolError


class GetProfileTool(Tool):
    name = 'get_profile'
    description = '读取当前用户的经历、能力、兴趣、价值观和当前目标。'
    input_model = ToolInput

    def _execute(self, context: ToolContext, arguments: ToolInput):
        profile = context.session.get(UserProfile, context.profile_id)
        if profile is None:
            raise ToolError('用户档案不存在。', 404)
        return dict(id=profile.id, **ProfileData.model_validate(profile).model_dump())
