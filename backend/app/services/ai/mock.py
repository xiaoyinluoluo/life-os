import json
from app.services.ai.base import PROFILE_MARKER


class MockModelClient:
    """Local deterministic responses, no SDK, network or credentials."""
    async def generate(self, system_prompt: str, user_message: str):
        profile = json.loads(system_prompt.split(PROFILE_MARKER, 1)[1])
        name = profile['name']
        goal = profile['goals'][0] if profile['goals'] else '找到适合自己的生活节奏'
        value = profile['values'][0] if profile['values'] else '身心平衡'
        skill = profile['skills'][0] if profile['skills'] else '已有经验'
        if any(word in user_message for word in ('焦虑', '压力', '累', '疲惫', '迷茫')):
            analysis = f'{name}，你的问题提到了压力或不确定感。结合你重视的“{value}”，可以先降低今天的行动负荷，再围绕“{goal}”选一个小步骤。这是模拟规则建议，不代表对你状态的诊断。'
            suggestions = ['把需要立即处理的事情和可以等待的事情分开', '为休息留出明确的时间', '选择一个可完成的小目标，避免同时推进太多事情']
            actions = ['用 5 分钟写下最困扰你的一个问题', '安排一次短暂休息，再用 10 分钟开始最小行动']
        elif any(word in user_message for word in ('学习', '技能', '职业', '工作', '方向')):
            analysis = f'{name}，结合你已有的“{skill}”能力和当前目标“{goal}”，可以用一个小作品探索你提到的方向，并根据体验再做调整。当前结果由本地模拟规则生成。'
            suggestions = [f'从已有的“{skill}”能力切入', '将探索限制在一个可展示的小作品内', '优先观察自己的兴趣与投入感，再决定下一步']
            actions = ['写下一个本周能完成的作品主题', '安排 25 分钟完成作品的第一个草稿']
        else:
            analysis = f'{name}，你提出的问题是“{user_message}”。结合你的目标“{goal}”和价值观“{value}”，建议先明确你最想改变的一件事，再开始一个小行动。当前结果由本地模拟规则生成。'
            suggestions = ['把问题改写成一个具体、可观察的目标', '从已有能力和兴趣中寻找切入点', '用一次小尝试收集反馈']
            actions = ['写下今天最重要的一件事', '用 15 分钟完成第一步，并记录感受']
        notes = profile.get('obsidian_notes', [])
        if notes:
            note = notes[0]
            label = '相关笔记' if note['match'] == 'keyword' else '近期笔记（未匹配关键词，仅供背景参考）'
            analysis += f"\n\n{label}《{note['file_name']}》摘录：{note['summary'][:400]}"
            suggestions.append(f"回顾《{note['file_name']}》，确认其中的经历或目标是否仍适用于当前问题。")
        return {'analysis': analysis, 'suggestions': suggestions, 'next_actions': actions}
