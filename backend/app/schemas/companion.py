from typing import List
from pydantic import BaseModel, ConfigDict, Field, field_validator


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)

    @field_validator('message')
    @classmethod
    def strip_message(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError('message must contain non-whitespace characters')
        return value


class CompanionResult(BaseModel):
    model_config = ConfigDict(extra='forbid')
    analysis: str = Field(min_length=1, max_length=8000)
    suggestions: List[str] = Field(max_length=10)
    next_actions: List[str] = Field(max_length=10)


class ProfileData(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    name: str = Field(min_length=1, max_length=80)
    background: str = Field(max_length=4000)
    skills: List[str]
    interests: List[str]
    values: List[str]
    goals: List[str]
