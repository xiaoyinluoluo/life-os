import json
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import CompanionChat, Goal, Project, Task, UserProfile, Source
from app.schemas.companion import ChatRequest, CompanionResult
from app.services.ai.openai_chat import OpenAIChatError, generate_reply
from app.services.ai.deepseek_chat import generate_reply as generate_deepseek_reply
from app.services.ai.doubao_chat import generate_reply as generate_doubao_reply
from app.services.database import get_session

router = APIRouter(prefix='/api/companion/conversation', tags=['Companion'])
PROFILE_ID = 1
CONTEXT_TURNS = 6


class Attachment(BaseModel):
    kind: Literal['goal', 'review', 'note', 'profile']
    id: int = Field(ge=1)


class SendMessage(ChatRequest):
    request_id: UUID
    attachment: Attachment | None = None
    provider: Literal['openai', 'deepseek', 'doubao'] = 'openai'


class ClearConversation(BaseModel):
    revision: int = Field(ge=0)
    provider: Literal['openai', 'deepseek', 'doubao'] = 'openai'


def provider_config(provider):
    return {
        'openai': (1, settings.openai_api_key, settings.openai_model, 'OPENAI_API_KEY'),
        'deepseek': (2, settings.deepseek_api_key, settings.deepseek_model, 'DEEPSEEK_API_KEY'),
        'doubao': (3, settings.doubao_api_key, settings.doubao_model, 'ARK_API_KEY'),
    }[provider]


def present(state, provider='openai'):
    _, api_key, model, _ = provider_config(provider)
    return {
        'configured': bool(api_key),
        'model': model,
        'provider': provider,
        'providers': {
            'openai': bool(settings.openai_api_key),
            'deepseek': bool(settings.deepseek_api_key),
            'doubao': bool(settings.doubao_api_key),
        },
        'revision': state.revision if state else 0,
        'turns': state.turns if state else [],
    }


def resolve_attachment(session, attachment):
    if attachment is None:
        return None
    profile = session.get(UserProfile, PROFILE_ID)
    show_demo = profile is not None and profile.workspace_mode != 'personal'
    if attachment.kind == 'profile':
        if attachment.id == PROFILE_ID and profile and profile.workspace_mode == 'personal':
            return {'kind': '个人档案', '标题': '个人档案', **{key: getattr(profile, key) for key in ('name', 'background', 'skills', 'interests', 'values', 'goals')}}
        raise HTTPException(404, '请先在个人模式中填写档案。')
    if attachment.kind == 'note':
        from app.integrations.obsidian.obsidian_reader import canonical_path
        note = session.get(Source, attachment.id)
        if note and note.status == 'active' and note.vault_path == canonical_path(settings.obsidian_path):
            return {'kind': 'Obsidian 笔记摘要', '标题': note.file_name, '路径': note.file_path,
                    '摘要': note.summary[:2000], '标签': note.tags}
        raise HTTPException(404, '笔记已失效或来自其他知识库，请重新同步并选择。')
    if attachment.kind == 'goal':
        goal = session.get(Goal, attachment.id)
        if goal and goal.profile_id == PROFILE_ID and (show_demo or not goal.is_demo):
            return {'kind': '目标', '标题': goal.title[:200], '想看到的结果': goal.outcome[:2000]}
    else:
        query = select(Task).join(Project).join(Goal).where(
            Task.id == attachment.id, Task.profile_id == PROFILE_ID,
            Project.profile_id == PROFILE_ID, Goal.profile_id == PROFILE_ID,
        )
        task = session.scalar(query)
        if task and task.review and (show_demo or not task.is_demo):
            return {'kind': '任务复盘', '任务': task.title[:300], '复盘': task.review[:2000]}
    raise HTTPException(404, '这条资料已不可用，请重新选择附件。')


@router.get('')
def conversation(provider: Literal['openai', 'deepseek', 'doubao'] = 'openai', session: Session = Depends(get_session)):
    chat_id, _, _, _ = provider_config(provider)
    return present(session.get(CompanionChat, chat_id), provider)


@router.post('')
async def send(payload: SendMessage, session: Session = Depends(get_session)):
    provider = payload.provider
    chat_id, api_key, model, variable = provider_config(provider)
    if not api_key:
        raise HTTPException(503, f'请先在本机后端配置 {variable}，再重启 Life OS。')
    state = session.get(CompanionChat, chat_id)
    snapshot = present(state, provider)
    request_id = str(payload.request_id)
    if any(turn['id'] == request_id for turn in snapshot['turns']):
        return snapshot

    attachment = resolve_attachment(session, payload.attachment)
    messages = []
    for turn in snapshot['turns'][-CONTEXT_TURNS:]:
        messages.extend((
            {'role': 'user', 'content': turn['message']},
            {'role': 'assistant', 'content': json.dumps(turn['reply'], ensure_ascii=False)[:4000]},
        ))
    message = payload.message
    if attachment:
        message += '\n\n本轮主动附上的参考资料：\n' + json.dumps(attachment, ensure_ascii=False)
    messages.append({'role': 'user', 'content': message})

    # Release the read transaction before the network call. A clear or another send
    # that commits meanwhile must not be overwritten by an older response.
    session.rollback()
    try:
        generator = {'openai': generate_reply, 'deepseek': generate_deepseek_reply, 'doubao': generate_doubao_reply}[provider]
        reply: CompanionResult = await generator(api_key, model, messages)
    except OpenAIChatError as error:
        raise HTTPException(error.status_code, str(error)) from error

    session.connection().exec_driver_sql('BEGIN IMMEDIATE')
    current = session.get(CompanionChat, chat_id)
    if current and any(turn['id'] == request_id for turn in current.turns):
        return present(current, provider)
    if (current.revision if current else 0) != snapshot['revision']:
        raise HTTPException(409, '对话已在另一个页面更新，请刷新后重试。')
    if current is None:
        current = CompanionChat(id=chat_id, revision=0, turns=[])
        session.add(current)
    turn = {'id': request_id, 'message': payload.message, 'reply': reply.model_dump(), 'model': model}
    if attachment:
        turn['attachment'] = attachment.get('标题', attachment.get('任务'))
    current.turns = [*current.turns, turn]
    current.revision += 1
    session.commit()
    return present(current, provider)


@router.post('/clear')
def clear(payload: ClearConversation, session: Session = Depends(get_session)):
    session.connection().exec_driver_sql('BEGIN IMMEDIATE')
    chat_id, _, _, _ = provider_config(payload.provider)
    state = session.get(CompanionChat, chat_id)
    if (state.revision if state else 0) != payload.revision:
        raise HTTPException(409, '对话已在另一个页面更新，请刷新后再清空。')
    if state is None:
        state = CompanionChat(id=chat_id, revision=0, turns=[])
        session.add(state)
    state.revision += 1
    state.turns = []
    session.commit()
    return present(state, payload.provider)
