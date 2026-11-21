import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TimeBudget } from './TimeBudget'
import { PersonalTask, PersonalGoal, OrganizeAction, Workspace, organizeTasks, personalRequest, shanghaiToday } from '../services/personal'

const tabs = ['今天', '逾期', '未安排', '以后', '已完成', '全部', '搁置', '归档'] as const
type Tab = typeof tabs[number]
const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'

function matches(task: PersonalTask, tab: Tab, today: string) {
  if (tab === '归档') return task.archived
  if (task.archived) return false
  if (tab === '已完成') return task.status === 'done'
  if (tab === '搁置') return task.status !== 'done' && task.goal_status !== 'active'
  if (task.status !== 'done' && task.goal_status !== 'active') return false
  if (tab === '全部') return true
  if (task.status === 'done') return false
  if (tab === '今天') return task.due_date === today
  if (tab === '逾期') return !!task.due_date && task.due_date < today
  if (tab === '以后') return !!task.due_date && task.due_date > today
  return !task.due_date
}

function GoalOptions({ goals }: { goals: PersonalGoal[] }) {
  return <>
    <option value="">日常事项</option>
    {goals.filter(goal => !goal.is_demo && goal.title !== '日常生活' && goal.status === 'active').map(goal =>
      <option key={goal.id} value={goal.id}>{goal.title}</option>)}
  </>
}

function TaskRow({ task, goals, today, changed, selection }: {
  task: PersonalTask
  goals: PersonalGoal[]
  today: string
  changed: (task: PersonalTask) => void
  selection?: { checked: boolean; toggle: () => void }
}) {
  const [editing, setEditing] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [due, setDue] = useState(task.due_date || '')
  const [review, setReview] = useState(task.review)
  const [goalId, setGoalId] = useState('')
  const [undoStatus, setUndoStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(path: string, body: unknown) {
    setBusy(true)
    setError('')
    try {
      const updated = await personalRequest<PersonalTask>(`/tasks/${task.id}/${path}`, body)
      setUndoStatus(path === 'status' && updated.status !== task.status ? task.status : null)
      changed(updated)
      setEditing(false)
      setReviewing(false)
      return true
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作失败，请重试。')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function organize(action: OrganizeAction) {
    setBusy(true)
    setError('')
    try {
      const [updated] = await organizeTasks([task.id], action)
      changed(updated)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作失败，请重试。')
    } finally {
      setBusy(false)
    }
  }

  const actionable = !task.archived && task.goal_status === 'active' && task.status !== 'done'

  return <li className="rounded-xl border border-slate-200 bg-white p-4">
    {selection && <label className="mb-3 flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" aria-label={`选中 ${task.title}`} checked={selection.checked} onChange={selection.toggle} />选中整理</label>}
    <div className="flex items-start gap-3">
      <input className="mt-1 h-5 w-5 shrink-0 accent-emerald-700" aria-label={`${task.status === 'done' ? '重开' : '完成'} ${task.title}`} type="checkbox" disabled={busy || task.archived || (task.goal_status !== 'active' && task.status !== 'done')} checked={task.status === 'done'} onChange={e => void save('status', { status: e.target.checked ? 'done' : 'todo' })} />
      <div className="min-w-0 flex-1">
        <p className={`break-words font-medium ${task.status === 'done' ? 'text-slate-500 line-through' : ''}`}>{task.title}</p>
        <p className="mt-1 text-xs text-slate-500">{task.is_demo && '示例 · '}{task.due_date || '未安排日期'}</p>
        {task.goal_title !== '日常生活' && <Link className="mt-1 inline-block break-words text-xs text-emerald-800 underline" to={`/planning?goal_id=${task.goal_id}`}>{task.goal_title}{task.goal_status === 'paused' ? ' · 已暂停' : task.goal_status === 'completed' ? ' · 已结束' : ''}</Link>}
        {task.review && <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{task.review}</p>}
      </div>
      {task.archived ? <button disabled={busy} onClick={() => void organize('restore')}>恢复任务</button> : <button className="!bg-slate-100 !text-slate-700" disabled={busy} onClick={() => { setTitle(task.title); setDue(task.due_date || ''); setGoalId(String(task.goal_id)); setEditing(!editing); setReviewing(false) }}>编辑</button>}
    </div>
    {!task.archived && <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      {(actionable || task.focus_date === today) && <button className="!bg-transparent !p-0 !text-emerald-800 underline" disabled={busy} onClick={() => void organize(task.focus_date === today ? 'unfocus' : 'focus')}>{task.focus_date === today ? '取消重点' : '列为今日重点'}</button>}
      {actionable && task.due_date !== today && <button className="!bg-transparent !p-0 !text-slate-700 underline" disabled={busy} onClick={() => void organize('today')}>改到今天</button>}
      {<button className="!bg-transparent !p-0 !text-emerald-800 underline" disabled={busy} onClick={() => { setReview(task.review); setReviewing(!reviewing); setEditing(false) }}>{task.review ? '编辑复盘' : '记录结果或阻碍'}</button>}
      {undoStatus && <button className="!bg-transparent !p-0 !text-emerald-800 underline" disabled={busy} onClick={async () => { if (await save('status', { status: undoStatus })) setUndoStatus(null) }}>撤销状态修改</button>}
      <button className="!bg-transparent !p-0 !text-slate-600 underline" disabled={busy} onClick={() => void organize('archive')}>归档</button>
    </div>}
    {editing && <form className="mt-4 space-y-3" onSubmit={e => { e.preventDefault(); void save('edit', { title, due_date: due || null, goal_id: goalId ? Number(goalId) : null }) }}>
      <label className="block text-sm">任务名称<input className={inputClass} value={title} maxLength={300} required onChange={e => setTitle(e.target.value)} /></label>
      <label className="block text-sm">计划日期<input className={inputClass} type="date" value={due} onChange={e => setDue(e.target.value)} /></label>
      <label className="block text-sm">所属目标<select className={inputClass} value={goalId} onChange={e => setGoalId(e.target.value)}>
        {goals.some(goal => goal.id === task.goal_id && (goal.is_demo || goal.title === '日常生活' || goal.status !== 'active')) && <option value={task.goal_id}>{task.goal_title}（当前）</option>}
        <GoalOptions goals={goals} />
      </select></label>
      <div className="flex gap-2"><button disabled={busy || !title.trim()}>保存修改</button><button type="button" className="!bg-slate-100 !text-slate-700" onClick={() => setEditing(false)}>取消</button></div>
    </form>}
    {reviewing && <form className="mt-4 space-y-3" onSubmit={e => { e.preventDefault(); void save('review', { review }) }}>
      <label className="block text-sm">结果如何，下次想怎样做？<textarea className={inputClass} maxLength={2000} value={review} onChange={e => setReview(e.target.value)} /></label>
      <div className="flex gap-2"><button disabled={busy}>保存复盘</button><button type="button" className="!bg-slate-100 !text-slate-700" onClick={() => setReviewing(false)}>取消</button></div>
    </form>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </li>
}

export function DailyTasks({ onChange }: { onChange: () => void }) {
  const [tasks, setTasks] = useState<PersonalTask[]>([])
  const [goals, setGoals] = useState<PersonalGoal[]>([])
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [name, setName] = useState('')
  const [choosing, setChoosing] = useState(false)
  const [tab, setTab] = useState<Tab>('今天')
  const [title, setTitle] = useState('')
  const [goalId, setGoalId] = useState('')
  const [due, setDue] = useState(shanghaiToday())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [kept, setKept] = useState<number[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [batchError, setBatchError] = useState('')
  const [today, setToday] = useState(shanghaiToday)

  function selectTab(value: Tab) {
    setTab(value)
    setKept([])
    setSelected([])
    setBatchError('')
  }

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [items, settings, availableGoals] = await Promise.all([
        personalRequest<PersonalTask[]>('/tasks'), personalRequest<Workspace>('/workspace'),
        personalRequest<PersonalGoal[]>('/goals'),
      ])
      setTasks(items)
      setWorkspace(settings)
      setGoals(availableGoals)
      setChoosing(settings.mode === 'pending')
      setName(settings.name.includes('演示') ? '' : settings.name)
    } catch {
      setError('无法读取任务，请检查服务后重试。')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() }, [])
  useEffect(() => {
    const update = () => {
      const date = shanghaiToday()
      if (date === today) return
      setToday(date)
      setDue(previous => previous === today ? date : previous)
      setKept([])
      setSelected([])
    }
    const timer = window.setInterval(update, 30000)
    window.addEventListener('focus', update)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', update)
    }
  }, [today])

  function changed(updated: PersonalTask) {
    const previous = tasks.find(task => task.id === updated.id)
    if (previous && previous.status !== updated.status) {
      setKept(ids => [...new Set([...ids, updated.id])])
      setNotice(updated.status === 'done' ? '任务已完成。' : '任务已重开。')
    } else {
      setNotice('已保存。')
    }
    setTasks(items => items.map(task => task.id === updated.id ? updated : task))
    setSelected(ids => ids.filter(id => id !== updated.id))
    onChange()
  }

  async function choose(mode: 'personal' | 'demo') {
    setBusy(true)
    setError('')
    try {
      await personalRequest('/workspace', { mode, name })
      await load()
      setChoosing(false)
      onChange()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '设置失败，请重试。')
    } finally { setBusy(false) }
  }

  async function addTask() {
    setBusy(true)
    setError('')
    try {
      const task = await personalRequest<PersonalTask>('/tasks', { title, due_date: due || null, goal_id: goalId ? Number(goalId) : null })
      setTasks(items => [task, ...items])
      setTitle('')
      selectTab(due === today ? '今天' : !due ? '未安排' : due < today ? '逾期' : '以后')
      setNotice('任务已添加。')
      onChange()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '添加失败，请重试。')
    } finally { setBusy(false) }
  }

  async function organizeSelected(action: OrganizeAction) {
    setBusy(true)
    setBatchError('')
    try {
      const updated = await organizeTasks(selected, action)
      const byId = new Map(updated.map(task => [task.id, task]))
      setTasks(items => items.map(task => byId.get(task.id) ?? task))
      setNotice(`已整理 ${updated.length} 项任务。`)
      setSelected([])
      onChange()
    } catch (reason) {
      setBatchError(reason instanceof Error ? reason.message : '整理失败，请重试。')
    } finally {
      setBusy(false)
    }
  }

  const focus = tasks.filter(task => task.focus_date === today && !task.archived && task.goal_status === 'active')
  const overdueCount = tasks.filter(task => matches(task, '逾期', today)).length
  const visible = tasks.filter(task => {
    if (tab === '今天' && focus.some(item => item.id === task.id)) return false
    return matches(task, tab, today) || (!task.archived && kept.includes(task.id))
  })
  const selectable = visible.filter(task => matches(task, '逾期', today))
  return <section className="space-y-5" aria-label="日常任务">
    {!loading && workspace?.mode === 'personal' && tab === '今天' && <TimeBudget tasks={tasks} today={today} />}
    {choosing && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <h2 className="text-lg font-semibold">从你的第一件事开始</h2>
      <p className="mt-2 text-sm text-slate-600">填写称呼后，开始记录自己的生活。已有个人记录会保留，示例内容将隐藏。</p>
      <label className="mt-4 block text-sm">怎么称呼你？<input className={`${inputClass} mt-2 max-w-sm`} maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label>
      <div className="mt-4 flex flex-wrap gap-3"><button disabled={busy || !name.trim()} onClick={() => void choose('personal')}>使用个人模式</button><button className="!bg-white !text-emerald-800" disabled={busy} onClick={() => void choose('demo')}>查看示例</button></div>
    </div>}
    {workspace && !choosing && <div className="flex items-center justify-between gap-3 text-sm text-slate-500"><span>{workspace.mode === 'personal' ? `${workspace.name}，安排一个今天能完成的行动。` : '当前包含演示内容'}</span><button className="shrink-0 whitespace-nowrap !bg-slate-100 !text-slate-600" onClick={() => setChoosing(true)}>使用设置</button></div>}
    {!loading && tab === '今天' && <section className="life-glass life-glass-green rounded-2xl border p-4 sm:p-5" aria-label="今日重点">
      <h2 className="font-semibold text-emerald-950">今日重点</h2>
      {focus.length ? <ul className="mt-3 space-y-3">{focus.map(task => <TaskRow key={task.id} task={task} goals={goals} today={today} changed={changed} />)}</ul> : <p className="mt-2 text-sm text-slate-600">从下方任务中选一两件今天最值得做的事。</p>}
    </section>}
    {overdueCount > 0 && <button className="!bg-amber-50 !text-amber-900" onClick={() => selectTab('逾期')}>整理 {overdueCount} 项逾期任务</button>}
    <form className="life-glass life-glass-brown rounded-2xl border p-5" onSubmit={e => { e.preventDefault(); void addTask() }}>
      <label htmlFor="quick-task" className="mb-3 block font-semibold">今天想推进什么？</label>
      <div className="flex flex-wrap items-end gap-3">
        <input id="quick-task" className={`${inputClass} min-w-0 flex-1 basis-52`} placeholder="写下一件具体的小事" maxLength={300} required value={title} onChange={e => setTitle(e.target.value)} />
        <label className="text-xs text-slate-500">计划日期<input aria-label="新任务日期" className={inputClass} type="date" value={due} onChange={e => setDue(e.target.value)} /></label>
        {goals.some(goal => !goal.is_demo && goal.title !== '日常生活' && goal.status === 'active') && <label className="min-w-0 max-w-full text-xs text-slate-500">所属目标<select className={inputClass} value={goalId} onChange={e => setGoalId(e.target.value)}><GoalOptions goals={goals} /></select></label>}
        <button disabled={busy || loading || !title.trim()}>添加任务</button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error} <button type="button" className="!bg-red-50 !text-red-700" onClick={() => void load()}>重试读取</button></p>}
    </form>
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="任务筛选">{tabs.map(value => <button key={value} role="tab" aria-selected={tab === value} className={tab === value ? '' : '!bg-slate-100 !text-slate-600'} onClick={() => selectTab(value)}>{value} <span>{tasks.filter(task => matches(task, value, today)).length}</span></button>)}</div>
    {tab === '逾期' && selectable.length > 0 && <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm">
      <button className="!bg-slate-100 !text-slate-700" onClick={() => setSelected(selected.length ? [] : selectable.slice(0, 200).map(task => task.id))}>{selected.length ? '取消选择' : selectable.length > 200 ? '选择前 200 项' : '全选逾期任务'}</button>
      {selected.length > 0 && <><span>已选 {selected.length} 项</span><button disabled={busy} onClick={() => void organizeSelected('today')}>改到今天</button><button disabled={busy} onClick={() => void organizeSelected('unschedule')}>取消日期</button><button disabled={busy} onClick={() => void organizeSelected('archive')}>归档选中</button></>}
      {batchError && <p role="alert" className="w-full text-red-700">{batchError}</p>}
    </div>}
    {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
    {loading ? <p role="status">正在读取任务…</p> : visible.length ? <ul className="space-y-3">{visible.map(task => <TaskRow key={task.id} task={task} goals={goals} today={today} changed={changed} selection={tab === '逾期' && matches(task, '逾期', today) ? {
      checked: selected.includes(task.id),
      toggle: () => setSelected(ids => ids.includes(task.id) ? ids.filter(id => id !== task.id) : ids.length < 200 ? [...ids, task.id] : ids),
    } : undefined} />)}</ul> : <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{tab === '今天' && focus.length > 0 ? '今天没有其他待办。' : '这个分类暂时没有任务。'}</div>}
  </section>
}
