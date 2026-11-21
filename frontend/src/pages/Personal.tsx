import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../components/Card'
import { PageHeading } from '../components/PageHeading'

type Profile = { name: string; background: string; skills: string[]; interests: string[]; values: string[]; goals: string[] }
const api = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '') + '/api/personal'
const fields = [['skills', '技能'], ['interests', '兴趣'], ['values', '价值观'], ['goals', '个人目标']] as const
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(api + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!response.ok) throw new Error(`请求失败（HTTP ${response.status}）`)
  return response.json() as Promise<T>
}

export default function Personal() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [lines, setLines] = useState<Record<string, string>>({})
  useEffect(() => {
    request<Profile>('/profile').then(value => { setProfile(value); setLines(Object.fromEntries(fields.map(([key]) => [key, value[key].join('\n')]))) }).catch(() => setMessage('无法读取档案，请检查后端服务。'))
  }, [])
  const action = async (fn: () => Promise<void>, success: string) => {
    setBusy(true); setMessage('')
    try { await fn(); setMessage(success) } catch (error) { setMessage(error instanceof Error ? error.message : '操作失败，请重试') } finally { setBusy(false) }
  }
  const inputClass = 'w-full rounded-lg border border-slate-300 p-3 text-sm'
  return <div className="space-y-6"><PageHeading title="个人档案" description="记录你的背景、兴趣和长期方向。" />
    {message && <p role="status" className="rounded-xl bg-slate-100 p-4 text-sm">{message}</p>}
    <Card title="个人档案">{profile && <form className="space-y-4" onSubmit={event => { event.preventDefault(); void action(async () => { await request('/profile', { ...profile, ...Object.fromEntries(fields.map(([key]) => [key, (lines[key] || '').split('\n').map(v => v.trim()).filter(Boolean)])) }) }, '档案已保存。') }}>
      <label className="block text-sm">称呼<input className={inputClass} required maxLength={80} value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} /></label>
      <label className="block text-sm">背景<textarea className={inputClass} maxLength={4000} value={profile.background} onChange={e => setProfile({ ...profile, background: e.target.value })} /></label>
      {fields.map(([key, label]) => <label key={key} className="block text-sm">{label}（每行一项）<textarea className={inputClass} value={lines[key] || ''} onChange={e => setLines({ ...lines, [key]: e.target.value })} /></label>)}
      <button disabled={busy} type="submit">保存档案</button>
    </form>}</Card>
    <Link className="text-sm text-emerald-700 underline" to="/dashboard">回到今天，安排任务 →</Link>
  </div>
}
