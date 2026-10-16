from typing import Any, Dict, Protocol

PROFILE_MARKER = '\nPROFILE_JSON:\n'


class ModelClient(Protocol):
    """Replaceable model boundary. An OpenAI adapter can implement this later."""
    async def generate(self, system_prompt: str, user_message: str) -> Dict[str, Any]:
        ...
