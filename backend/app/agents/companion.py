from sqlalchemy.orm import Session
from app.agents.prompts import build_system_prompt
from app.schemas.companion import CompanionResult
from app.services.ai.base import ModelClient
from app.schemas.companion import ProfileData
from app.tools.base import ToolContext
from app.tools.registry import registry


class LifeCompanionAgent:
    def __init__(self, session: Session, model: ModelClient):
        self.session = session
        self.model = model

    async def respond(self, message: str) -> CompanionResult:
        tool_context = ToolContext(session=self.session)
        profile = ProfileData.model_validate(registry.execute('get_profile', {}, tool_context))
        context = registry.execute('search_knowledge', {'query': message, 'limit': 3}, tool_context)['items']
        self.session.commit()  # local read-tool audit metadata only
        system_prompt = build_system_prompt(profile, context)
        result = await self.model.generate(system_prompt=system_prompt, user_message=message)
        return CompanionResult.model_validate(result)

    def available_tools(self):
        return registry.available_tools()

    async def propose_action(self, request):
        from app.services.tool_actions import preview_action
        return await preview_action(self.session, request, self.model)
