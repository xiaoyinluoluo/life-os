import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { personalRequest, shanghaiToday, type PersonalGoal } from '../services/personal'

export function ActionDraft({ text, sourceKey, close }: { text: string; sourceKey: string; close: () => void }) {
  const [title, setTitle] = useState(text.slice(0, 300))
  const [due, setDue] = useState(shanghaiToday())
  const [goal, setGoal] = useState('')
  const [goals, setGoals] = useState<PersonalGoal[]>([])
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { personalRequest<PersonalGoal[]>('/goals').then(setGoals).catch(() => setError('目标加载失败，可保存为日常事项。')) }, [])
  async function save() {
    setBusy(true); setError('')
    try {
      await personalRequest('/tasks', { title, due_date: due || null, goal_id: goal ? Number(goal) : null, source_key: sourceKey })
      setSaved(true)
    } catch (e) { setError(e instanceof Error ? e.message : '保存失败') }
    finally { setBusy(false) }
  }
  return <section className="my-4 space-y-3 rounded-xl border-2 border-emerald-600 bg-white p-5" aria-label="确认行动">
    <h3 className="font-semibold">确认这一步行动</h3>
    {saved ? <p role="status">已加入计划。<Link className="text-emerald-800 underline" to="/dashboard">去今天安排和执行</Link></p> : <form className="space-y-3" onSubmit={e => { e.preventDefault(); void save() }}>
      <label className="block">行动内容<input className="mt-1 w-full rounded border p-2" required maxLength={300} value={title} onChange={e => setTitle(e.target.value)} /></label>
      <label className="block">计划日期<input className="ml-3 rounded border p-2" type="date" value={due} onChange={e => setDue(e.target.value)} /></label>
      <label className="block">所属目标<select className="ml-3 max-w-full rounded border p-2" value={goal} onChange={e => setGoal(e.target.value)}><option value="">日常事项</option>{goals.filter(g => !g.is_demo && g.status === 'active' && g.title !== '日常生活').map(g => <option key={g.id} value={g.id}>{g.title}</option>)}</select></label>
      <button disabled={busy || !title.trim()}>{busy ? '正在保存…' : '确认加入计划'}</button>
    </form>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <button type="button" disabled={busy} className="!bg-slate-100 !text-slate-700" onClick={close}>{saved ? '关闭' : '取消'}</button>
  </section>
}
