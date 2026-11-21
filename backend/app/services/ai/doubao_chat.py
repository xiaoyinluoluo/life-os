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
                'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
                headers={'Authorization': f'Bearer {api_key}'},
                json={
                    'model': model,
                    'messages': [{'role': 'system', 'content': instructions}, *messages],
                    'response_format': {'type': 'json_object'},
                    'thinking': {'type': 'disabled'},
                    'max_tokens': 2048,
                    'stream': False,
                },
            ), timeout=30)
    except (httpx.TimeoutException, asyncio.TimeoutError) as error:
        raise OpenAIChatError(504, '豆包响应超时，请稍后重试。') from error
    except httpx.HTTPError as error:
        raise OpenAIChatError(503, '暂时连不上火山方舟，请检查网络后重试。') from error
    if response.status_code == 401:
        raise OpenAIChatError(503, '火山方舟 API Key 无效或已撤销，请检查本机配置。')
    if response.status_code == 429:
        raise OpenAIChatError(429, '豆包请求过多或额度不足，请检查火山方舟用量。')
    if not response.is_success:
        raise OpenAIChatError(502, '豆包暂时无法完成请求，请检查模型开通状态和账号额度。')
    try:
        choice = response.json()['choices'][0]
        if choice.get('finish_reason') != 'stop':
            raise ValueError('incomplete response')
        return CompanionResult.model_validate(json.loads(choice['message']['content']))
    except (ValueError, TypeError, KeyError, IndexError) as error:
        raise OpenAIChatError(502, '豆包返回了无法显示的回复，请稍后重试。') from error
