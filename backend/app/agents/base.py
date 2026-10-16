from typing import Protocol
from app.schemas.companion import CompanionResult

class CompanionAgent(Protocol):
    async def respond(self, message: str) -> CompanionResult:
        ...
