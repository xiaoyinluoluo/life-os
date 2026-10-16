import { Card } from '../components/Card'
import { PageHeading } from '../components/PageHeading'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toolApi, type ToolProposal } from '../services/tools'

export default function Planning() {
  const [params] = useSearchParams()
  const planId = params.get('plan_id')
  const [plan, setPlan] = useState<ToolProposal | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    setPlan(null); setError('')
    if (planId) toolApi.get(planId, controller.signal).then(value => { if (!controller.signal.aborted) setPlan(value) }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '读取计划失败') })
    return () => controller.abort()
  }, [planId])
  return <><PageHeading title="行动计划" description="让重要的目标，落到今天的一小步。" />
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {!planId ? <Card title="从一个目标开始"><p className="mb-4 text-sm leading-7 text-slate-500">在生命伙伴中生成行动方案，确认后即可查看已创建的项目和任务。</p><Link className="text-sm font-medium text-emerald-700 underline" to="/companion">前往生命伙伴 →</Link></Card> : !plan && !error ? <p role="status">正在读取计划…</p> : plan && <Card title={plan.project?.title ?? '行动执行记录'}><p className="mb-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">{plan.project?.description ?? plan.summary}</p><p className="mb-4 text-xs text-slate-500">执行状态：{plan.status === 'executed' ? '已完成创建' : plan.status}</p><ol className="space-y-3">{plan.tasks?.map((task, index) => <li key={task.id} className="rounded-xl bg-slate-50 p-4"><h2 className="mb-2 text-sm font-medium">{index + 1}. {task.title}</h2><p className="text-sm leading-6 text-slate-600">{task.description}</p><p className="mt-2 text-xs text-slate-500">优先级 {task.priority} · 截止 {task.due_date ?? '未设置'} · 状态 {task.status}</p></li>)}</ol><Link className="mt-5 inline-block text-sm text-emerald-700 underline" to="/dashboard">回到生命驾驶舱 →</Link></Card>}
  </>
}
