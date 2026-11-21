import { useEffect, useState } from 'react'
import { workbenchRequest, type DayPlan } from '../services/workbench'
import type { PersonalTask } from '../services/personal'

export function TimeBudget({ tasks, today }: { tasks: PersonalTask[]; today: string }) {
  const [plan, setPlan] = useState<DayPlan>({ minutes: 120, estimates: {} })
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => { let active = true; setReady(false); workbenchRequest<DayPlan>('/day').then(p => { if (active) { setPlan(p); setReady(true) } }).catch(() => { if (active) setMessage('时间安排读取失败，请刷新页面。') }); return () => { active = false } }, [today])
  const selected = tasks.filter(t => !t.archived && t.status !== 'done' && t.goal_status === 'active' && (t.due_date === today || t.focus_date === today))
  const total = selected.reduce((sum, t) => sum + (plan.estimates[t.id] ?? 25), 0)
  return <section className="life-glass life-glass-brown space-y-3 rounded-2xl border p-5" aria-label="今日时间预算">
    <h2 className="font-semibold">今天有多少时间？</h2>
    <p className="text-sm text-slate-600">先安排能放进今天的事情。未填写的任务暂按 25 分钟估算。</p>
    <form className="space-y-3" onSubmit={async e => { e.preventDefault(); setBusy(true); try { await workbenchRequest('/day', plan); setMessage('时间安排已保存。') } catch { setMessage('保存失败，请重试。') } finally { setBusy(false) } }}>
      <label className="block">可用时间（分钟）<input type="number" min={0} max={1440} required disabled={!ready || busy} className="ml-2 w-24 rounded border p-2" value={plan.minutes} onChange={e => setPlan({ ...plan, minutes: Number(e.target.value) })} /></label>
      {selected.map(task => <label key={task.id} className="flex items-center justify-between gap-3 text-sm"><span className="break-words">{task.title}</span><span className="shrink-0"><input aria-label={`${task.title}预计分钟`} type="number" min={1} max={1440} disabled={!ready || busy} required className="w-20 rounded border p-2" value={plan.estimates[task.id] ?? 25} onChange={e => setPlan({ ...plan, estimates: { ...plan.estimates, [task.id]: Number(e.target.value) } })} /> 分钟</span></label>)}
      <p className={total > plan.minutes ? 'text-amber-900' : 'text-emerald-800'}>已安排 {total} / {plan.minutes} 分钟{total > plan.minutes ? `，超出 ${total - plan.minutes} 分钟。请把部分任务推迟，或取消日期。` : `，还可留出 ${plan.minutes - total} 分钟。`}</p>
      <button disabled={!ready || busy}>{busy ? '保存中…' : '保存时间安排'}</button>
    </form>
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>
}
