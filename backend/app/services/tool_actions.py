import hashlib
import hmac
import secrets
import threading
import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from app.models import Goal, Project, Task, ToolProposal
from app.schemas.companion import CompanionResult, ProfileData
from app.agents.prompts import build_system_prompt
from app.tools.base import ToolContext, ToolError, audit, operations_hash, resolve_arguments
from app.tools.registry import registry
from app.tools.update_task_tool import UpdateTaskInput
from app.tools.task_tool import owned_project
from app.services.dashboard_demo import BUSINESS_TZ

confirmation_lock = threading.Lock()


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def public_proposal(proposal):
    return dict(id=proposal.id, status=proposal.status, analysis=proposal.analysis, summary=proposal.summary,
        operations=proposal.operations, result=proposal.result, created_at=utc(proposal.created_at).isoformat(), expires_at=utc(proposal.expires_at).isoformat())


def owned_proposal(session, proposal_id, profile_id=1):
    proposal = session.get(ToolProposal, proposal_id)
    if proposal is None or proposal.profile_id != profile_id:
        raise ToolError('执行方案不存在。', 404)
    return proposal


async def preview_action(session, request, model, profile_id=1):
    context = ToolContext(session=session, profile_id=profile_id)
    profile = registry.execute('get_profile', {}, context)
    knowledge = registry.execute('search_knowledge', {'query': request.message, 'limit': 3}, context)['items']
    session.commit()  # persist read audit before waiting for model suggestions
    # These are suggestions only. The model cannot execute a write or grant approval.
    answer = CompanionResult.model_validate(await model.generate(build_system_prompt(ProfileData.model_validate(profile), knowledge), request.message))
    if request.action_type == 'create_plan':
        goal = session.get(Goal, request.goal_id)
        if goal is None or goal.profile_id != profile_id:
            raise ToolError('归属目标不存在或不属于当前用户。', 404)
        if goal.status != 'active':
            raise ToolError('请选择进行中的目标。', 409)
        competition = any(word in request.message.lower() for word in ('比赛', '竞赛', 'competition', 'hackathon'))
        title = 'AI Agent 比赛参赛计划' if competition else '行动项目：' + request.message[:70]
        titles = ['确认比赛要求与提交时间', '确定 Agent 场景和最小演示范围', '实现并验证核心工具闭环', '整理演示材料与参赛说明', '完成一次演示彩排与复盘'] if competition else list(answer.next_actions[:3])
        for fallback in ('明确目标与验收标准', '完成一次小范围尝试', '记录结果并调整下一步', '整理交付材料', '回顾本次行动的收获'):
            if len(titles) >= 5:
                break
            titles.append(fallback)
        today = datetime.now(BUSINESS_TZ).date()
        operations = [{'tool_name': 'create_project', 'arguments': {'goal_id': goal.id, 'title': title, 'description': request.message}}]
        for index, task_title in enumerate(titles[:5]):
            operations.append({'tool_name': 'create_task', 'arguments': {'project_id': '$created_project', 'title': task_title[:200],
                'description': '围绕项目目标完成该步骤，并记录结果。', 'priority': 'high' if index == 0 else 'medium', 'due_date': (today + timedelta(days=index)).isoformat()}})
        summary = f'准备在目标“{goal.title}”下创建 1 个项目和 5 个任务；日期为可确认的建议日期，不代表真实比赛截止时间。'
    else:
        values = UpdateTaskInput.model_validate(dict(task_id=request.task_id, **request.changes))
        task = session.get(Task, request.task_id)
        if task is None or task.profile_id != profile_id:
            raise ToolError('任务不存在或不属于当前用户。', 404)
        owned_project(context, task.project_id)
        operations = [{'tool_name': 'update_task', 'arguments': values.model_dump(mode='json', exclude_unset=True)}]
        summary = f'准备修改任务“{task.title}”，仅执行下方列出的字段变更。'
    for operation in operations:
        tool = registry.get(operation['tool_name'])
        tool.input_model.model_validate(resolve_arguments(operation['arguments'], {'created_project': 1}))
    now = datetime.now(timezone.utc)
    token = secrets.token_urlsafe(32)
    proposal = ToolProposal(id=str(uuid.uuid4()), profile_id=profile_id, agent_name='companion', status='pending',
        confirmation_hash=hashlib.sha256(token.encode()).hexdigest(), operations_hash=operations_hash(operations),
        operations=operations, analysis=answer.analysis, summary=summary, expires_at=now + timedelta(minutes=30))
    session.add(proposal); session.commit()
    return dict(**public_proposal(proposal), confirmation_token=token, steps=[
        {'label': '读取个人档案', 'status': 'success'}, {'label': '搜索知识索引', 'status': 'success'},
        {'label': '分析目标并生成待确认方案（模拟编排）', 'status': 'success'}, {'label': '等待用户确认', 'status': 'pending'}])


def verify_token(proposal, token):
    if not hmac.compare_digest(proposal.confirmation_hash, hashlib.sha256(token.encode()).hexdigest()):
        raise ToolError('确认凭据不匹配，请重新生成方案。', 403)


def confirm_action(session, proposal_id, request, profile_id=1):
    if not confirmation_lock.acquire(blocking=False):
        raise ToolError('已有方案正在执行，请稍后重试。', 409)
    completed = []
    current_name, current_arguments = 'confirm_proposal', {'proposal_id': proposal_id}
    context = ToolContext(session=session, profile_id=profile_id, proposal_id=proposal_id)
    try:
        # SQLite writer lock ensures two processes cannot execute the same proposal.
        session.connection().exec_driver_sql('BEGIN IMMEDIATE')
        proposal = owned_proposal(session, proposal_id, profile_id)
        verify_token(proposal, request.confirmation_token)
        if not request.confirmed:
            raise ToolError('用户尚未确认，不能执行写入操作。', 403)
        if proposal.status == 'executed':
            result = dict(proposal.result)
            result['already_executed'] = True
            session.rollback()
            return result
        if proposal.status != 'pending':
            raise ToolError('该方案已取消、过期或失败，请重新生成。', 409)
        if utc(proposal.expires_at) <= datetime.now(timezone.utc):
            proposal.status = 'expired'; session.commit()
            raise ToolError('方案已超过 30 分钟有效期，请重新生成。', 409)
        if proposal.operations_hash != operations_hash(proposal.operations):
            raise ToolError('方案内容已变化，请重新生成并确认。', 409)
        proposal.status = 'executing'
        session.flush()
        outputs = []
        for index, operation in enumerate(proposal.operations):
            current_name = operation['tool_name']
            current_arguments = resolve_arguments(operation['arguments'], context.references)
            context.operation_index = index
            output = registry.execute(current_name, current_arguments, context)
            completed.append((current_name, current_arguments, output))
            outputs.append(dict(tool_name=current_name, output=output))
            if current_name == 'create_project':
                context.references['created_project'] = output['project_id']
        created_tasks = [item['output']['task_id'] for item in outputs if item['tool_name'] == 'create_task']
        result = dict(success=True, proposal_id=proposal.id, message='行动计划已创建' if created_tasks else '任务已更新',
            project_id=context.references.get('created_project'), task_ids=created_tasks, outputs=outputs,
            already_executed=False, plan_url='/planning?plan_id=' + proposal.id,
            steps=[{'label': ('创建项目' if item['tool_name'] == 'create_project' else '创建任务' if item['tool_name'] == 'create_task' else '更新任务'), 'status': 'success'} for item in outputs])
        proposal.status, proposal.result = 'executed', result
        session.commit()
        return result
    except Exception as error:
        session.rollback()
        public_error = error if isinstance(error, ToolError) else ToolError('执行失败，业务数据已回滚，请重新生成方案。', 409 if isinstance(error, SQLAlchemyError) else 500)
        proposal = session.get(ToolProposal, proposal_id)
        authorized = proposal is not None and proposal.profile_id == profile_id and hmac.compare_digest(proposal.confirmation_hash, hashlib.sha256(request.confirmation_token.encode()).hexdigest())
        if authorized and completed:
            for name, arguments, output in completed:
                audit(context, name, arguments, dict(output, rolled_back=True), 'rolled_back')
        if authorized and public_error.status_code not in (403, 404) and proposal.status == 'pending':
            proposal.status = 'failed'
        audit(context, current_name, current_arguments, {'success': False, 'message': public_error.message}, 'denied' if public_error.status_code == 403 else 'failed')
        session.commit()
        raise public_error
    finally:
        confirmation_lock.release()


def cancel_action(session, proposal_id, token, profile_id=1):
    session.connection().exec_driver_sql('BEGIN IMMEDIATE')
    proposal = owned_proposal(session, proposal_id, profile_id)
    verify_token(proposal, token)
    if proposal.status != 'pending':
        raise ToolError('仅能取消待确认方案。', 409)
    proposal.status = 'cancelled'
    audit(ToolContext(session=session, profile_id=profile_id, proposal_id=proposal_id), 'cancel_proposal', {'proposal_id': proposal_id}, {'success': True}, 'success')
    session.commit()
    return public_proposal(proposal)
