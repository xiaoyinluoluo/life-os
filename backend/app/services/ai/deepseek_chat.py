import asyncio
import json

import httpx

from app.schemas.companion import CompanionResult
from app.services.ai.openai_chat import INSTRUCTIONS, OpenAIChatError


async def generate_reply(api_key, model, messages):
    instructions = (
        INSTRUCTIONS + ' 请只输出 JSON，格式示例：'
        '{"analysis":"理解与分析","suggestions":["建议"],"next_actions":["下一步行动"]}。'
    )
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(25, connect=8)) as client:
            response = await asyncio.wait_for(client.post(
                'https://api.deepseek.com/chat/completions',
                headers={'Authorization': f'Bearer {api_key}'},
                json={
                    'model': model,
                    'messages': [{'role': 'system', 'content': instructions}, *messages],
                    'response_format': {'type': 'json_object'},
                    'max_tokens': 2048,
                    'stream': False,
                },
            ), timeout=30)
    except (httpx.TimeoutException, asyncio.TimeoutError) as error:
        raise OpenAIChatError(504, 'DeepSeek 响应超时，请稍后重试。') from error
    except httpx.HTTPError as error:
        raise OpenAIChatError(503, '暂时连不上 DeepSeek，请检查网络后重试。') from error
    if response.status_code == 401:
        raise OpenAIChatError(503, 'DeepSeek API Key 无效或已撤销，请检查本机配置。')
    if response.status_code == 402:
        raise OpenAIChatError(402, 'DeepSeek 余额不足，请检查 API 平台账单。')
    if response.status_code == 429:
        raise OpenAIChatError(429, 'DeepSeek 请求过多，请稍后重试。')
    if not response.is_success:
        raise OpenAIChatError(502, 'DeepSeek 暂时无法完成请求，请检查模型配置或稍后重试。')
    try:
        choice = response.json()['choices'][0]
        if choice.get('finish_reason') != 'stop':
            raise ValueError('incomplete response')
        return CompanionResult.model_validate(json.loads(choice['message']['content']))
    except (ValueError, TypeError, KeyError, IndexError) as error:
        raise OpenAIChatError(502, 'DeepSeek 返回了无法显示的回复，请稍后重试。') from error
