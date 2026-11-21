import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { GoalStatus, PersonalGoal, PersonalTask, personalRequest } from '../services/personal'
import { DecisionValidation } from './DecisionValidation'

const labels: Record<GoalStatus, string> = { active: '进行中', paused: '已暂停', completed: '已结束' }
const field = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'
const secondary = '!bg-slate-100 !text-slate-700'

function GoalCard({ goal, tasks, updated, added, refresh }: {
  goal: PersonalGoal
  tasks: PersonalTask[]
  updated: (goal: PersonalGoal) => void
  added: (task: PersonalTask) => void
  refresh: () => void
}) {
  const [mode, setMode] = useState<'edit' | 'decision' | 'task' | null>(null)
  const [title, setTitle] = useState(goal.title)
  const [outcome, setOutcome] = useState(goal.outcome)
  const [status, setStatus] = useState(goal.status)
  const [note, setNote] = useState('')
  const [result, setResult] = useState('')
  const [nextTask, setNextTask] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  async function submit(action: () => Promise<void>, message: string) {
    setBusy(true)
    setError('')
    setSaved('')
    try {
      await action()
      setMode(null)
      setSaved(message)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败，请重试。')
    } finally {
      setBusy(false)
    }
  }

  const latest = goal.decisions[goal.decisions.length - 1]
  const unfinished = tasks.filter(task => !task.archived && task.status !== 'done')
  const completed = tasks.filter(task => task.status === 'done')

  return <section className="life-panel space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-label={goal.title}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <h2 className="min-w-0 break-words text-xl font-semibold">{goal.title}</h2>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{goal.is_demo && '示例 · '}{labels[goal.status]}</span>
    </div>
    <div>
      <h3 className="text-sm font-semibold">想看到的结果</h3>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">{goal.outcome || '还未写下怎样算有进展。'}</p>
    </div>
    {latest && <div className="rounded-lg bg-emerald-50 p-4">
      <h3 className="text-sm font-semibold text-emerald-900">上次的决定 · {labels[latest.status]}</h3>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-emerald-950">{latest.note}</p>
      {latest.result && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-emerald-950"><strong>实际进展</strong> · {latest.result}</p>}
    </div>}
    <div className="flex flex-wrap gap-2">
      <button className={secondary} onClick={() => { setTitle(goal.title); setOutcome(goal.outcome); setMode('edit') }}>编辑目标</button>
      <button className={secondary} onClick={() => { setStatus(goal.status); setNote(''); setResult(''); setMode('decision') }}>记录调整</button>
      {goal.status === 'active' && !goal.is_demo && <button onClick={() => setMode('task')}>安排下一步</button>}
    </div>
    {mode === 'edit' && <form className="space-y-3" onSubmit={e => {
      e.preventDefault()
      void submit(async () => updated(await personalRequest<PersonalGoal>(`/goals/${goal.id}/edit`, { title, outcome })), '目标已保存。')
    }}>
      <label className="block text-sm">目标名称<input className={field} required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} /></label>
      <label className="block text-sm">想看到的结果<textarea className={field} maxLength={2000} value={outcome} onChange={e => setOutcome(e.target.value)} /></label>
      <button disabled={busy || !title.trim()}>保存目标</button>
    </form>}
    {mode === 'decision' && <form className="space-y-3" onSubmit={e => {
      e.preventDefault()
      void submit(async () => updated(await personalRequest<PersonalGoal>(`/goals/${goal.id}/decisions`, { status, note, result })), '决定已记录。')
    }}>
      <label className="block text-sm">接下来怎么处理<select className={field} value={status} onChange={e => setStatus(e.target.value as GoalStatus)}>
        <option value="active">{goal.status === 'active' ? '继续推进' : '恢复推进'}</option>
        <option value="paused">暂停目标</option>
        <option value="completed">结束目标</option>
      </select></label>
      {status !== 'active' && <p className="text-sm text-slate-600">未完成的任务会移到首页的「搁置」。</p>}
      <label className="block text-sm">为什么这样决定？<textarea className={field} value={note} maxLength={2000} required onChange={e => setNote(e.target.value)} /></label>
      <label className="block text-sm">实际进展（可选）<textarea className={field} value={result} maxLength={2000} onChange={e => setResult(e.target.value)} /></label>
      <button disabled={busy || !note.trim()}>保存决定</button>
    </form>}
    {mode === 'task' && <form className="space-y-3" onSubmit={e => {
      e.preventDefault()
      void submit(async () => {
        added(await personalRequest<PersonalTask>('/tasks', { title: nextTask, goal_id: goal.id, due_date: null }))
        setNextTask('')
      }, '下一步已添加到首页「未安排」。')
    }}>
      <label className="block text-sm">下一步要做什么？<input className={field} value={nextTask} maxLength={300} required onChange={e => setNextTask(e.target.value)} /></label>
      <button disabled={busy || !nextTask.trim()}>添加下一步</button>
    </form>}
    {mode && <button className={secondary} disabled={busy} onClick={() => { setMode(null); setError('') }}>取消</button>}
    {saved && <p role="status" className="text-sm text-emerald-800">{saved}</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2">
      <div>
        <h3 className="text-sm font-semibold">{goal.status === 'active' ? '待办' : '搁置的待办'}</h3>
        <ul className="mt-2 space-y-2 text-sm text-slate-600">{unfinished.map(task => <li key={task.id} className="break-words">{task.title} <span className="text-xs text-slate-500">{task.due_date || '未安排'}</span></li>)}</ul>
        {unfinished.length === 0 && <p className="mt-2 text-sm text-slate-500">没有待办</p>}
      </div>
      <div>
        <h3 className="text-sm font-semibold">完成记录与复盘</h3>
        <ul className="mt-2 space-y-3 text-sm text-slate-600">{completed.map(task => <li key={task.id} className="break-words">
          <p>{task.title}{task.archived && ' · 已归档'}</p>
          {task.review && <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-2">{task.review}</p>}
        </li>)}</ul>
        {completed.length === 0 && <p className="mt-2 text-sm text-slate-500">暂无完成记录</p>}
      </div>
    </div>
    {!goal.is_demo && <DecisionValidation goalId={goal.id} canCreate={goal.status === 'active'} changed={refresh} />}
    {goal.decisions.length > 1 && <details className="border-t border-slate-200 pt-4">
      <summary className="cursor-pointer text-sm font-medium">更早的决定</summary>
      <ol className="mt-3 space-y-3 text-sm">{goal.decisions.slice(0, -1).reverse().map((decision, index) => <li key={index}>
        <p className="text-xs text-slate-500">{new Date(decision.at).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })} · {labels[decision.status]}</p>
        <p className="whitespace-pre-wrap break-words">{decision.note}</p>
        {decision.result && <p className="mt-1 whitespace-pre-wrap break-words text-slate-600">实际进展 · {decision.result}</p>}
      </li>)}</ol>
    </details>}
  </section>
}

export function GoalPlans() {
  const [revision, setRevision] = useState(0)
  const [params] = useSearchParams()
  const goalId = params.get('goal_id')
  const [goals, setGoals] = useState<PersonalGoal[] | null>(null)
  const [tasks, setTasks] = useState<PersonalTask[]>([])
  const [title, setTitle] = useState('')
  const [outcome, setOutcome] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([personalRequest<PersonalGoal[]>('/goals'), personalRequest<PersonalTask[]>('/tasks')])
      .then(([items, records]) => {
        if (active) {
          setGoals(items)
          setTasks(records)
        }
      })
      .catch(() => { if (active) setError('暂时无法读取目标，请刷新重试。') })
    return () => { active = false }
  }, [revision])

  async function addGoal() {
    setBusy(true)
    setError('')
    try {
      const goal = await personalRequest<PersonalGoal>('/goals', { title, outcome })
      setGoals(items => [...(items ?? []), goal])
      setTitle('')
      setOutcome('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '创建失败，请重试。')
    } finally {
      setBusy(false)
    }
  }

  const visible = (goals ?? []).filter(goal => goalId ? String(goal.id) === goalId : goal.title !== '日常生活')
  return <div className="space-y-5">
    {goalId ? <Link className="text-sm text-emerald-800 underline" to="/planning">查看全部目标</Link> : <form className="life-panel space-y-3 rounded-2xl border border-slate-200 bg-white p-5" onSubmit={e => { e.preventDefault(); void addGoal() }}>
      <h2 className="font-semibold">新增目标</h2>
      <label className="block text-sm">目标名称<input className={field} required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} /></label>
      <label className="block text-sm">想看到的结果<textarea className={field} maxLength={2000} value={outcome} placeholder="例如，一位朋友可以独立走完演示流程。" onChange={e => setOutcome(e.target.value)} /></label>
      <button disabled={busy || goals === null || !title.trim()}>创建目标</button>
    </form>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {goals === null && !error && <p role="status">正在读取目标…</p>}
    {goals && !visible.length && <p className="text-sm text-slate-500">{goalId ? '没有找到这个目标。' : '还没有个人目标。'}</p>}
    {visible.map(goal => <GoalCard key={goal.id} goal={goal} tasks={tasks.filter(task => task.goal_id === goal.id)} refresh={() => setRevision(value => value + 1)}
      updated={updated => setGoals(items => items?.map(item => item.id === updated.id ? updated : item) ?? null)}
      added={task => setTasks(items => [task, ...items])} />)}
  </div>
}
