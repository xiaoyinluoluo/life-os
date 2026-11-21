import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DecisionValidation } from '../components/DecisionValidation'
import { workbenchRequest, backupUrl } from '../services/workbench'
import type { PersonalGoal, PersonalTask } from '../services/personal'

type Reflection = { result: string; obstacle: string; adjustment: string }
type Week = { start: string; end: string; completed: PersonalTask[]; overdue: PersonalTask[]; goals: PersonalGoal[]; reflection: Reflection }
export default function Review() {
  const [week, setWeek] = useState<Week | null>(null)
  const [backups, setBackups] = useState<{ name: string; bytes: number }[]>([])
  const [message, setMessage] = useState('')
  const [insights, setInsights] = useState<{ id: string; title: string; body: string; at: string; goal_id?: number; experiment_id?: string }[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { Promise.all([workbenchRequest<Week>('/week'), workbenchRequest<typeof backups>('/backups')]).then(([w, b]) => { setWeek(w); setBackups(b) }).catch(() => setError('回顾加载失败，请刷新页面。')) }, [])
  useEffect(() => { workbenchRequest<typeof insights>('/insights').then(setInsights).catch(() => setError('长期参考加载失败，请刷新页面。')) }, [])
  async function backup() {
    setBusy(true); setError('')
    try { await workbenchRequest('/backups', {}); setBackups(await workbenchRequest('/backups')); setMessage('本地备份已创建并通过 SQLite 完整性检查。') }
    catch { setError('备份失败，请检查磁盘空间后重试。') }
    finally { setBusy(false) }
  }
  return <div className="space-y-6"><h1 className="text-3xl font-semibold">每周回顾与备份</h1>
    <DecisionValidation />
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {!week && !error && <p role="status">正在读取本周记录…</p>}
    {week && <><section className="life-panel space-y-4 rounded-2xl border bg-white p-5"><h2 className="text-xl font-semibold">{week.start} 至 {week.end} · 上海时间</h2><p>本周完成 {week.completed.length} 项 · 当前逾期 {week.overdue.length} 项</p>
      <h3 className="font-semibold">完成了什么，结果如何？</h3>{week.completed.length === 0 && <p>本周还没有完成记录。</p>}{week.completed.map(t => <article key={t.id} className="rounded-lg bg-emerald-50 p-3"><p>{t.title} · {t.goal_title}</p><p className="mt-2 whitespace-pre-wrap">{t.review || '尚未记录结果。'}</p></article>)}
      <h3 className="font-semibold">哪些行动卡住了？</h3>{week.overdue.map(t => <p key={t.id}>{t.due_date} · {t.title} · <Link className="text-emerald-800 underline" to={`/planning?goal_id=${t.goal_id}`}>查看目标</Link></p>)}{week.overdue.length === 0 && <p>没有逾期行动。</p>}
      <h3 className="font-semibold">目标有没有实际进展？</h3>{week.goals.filter(g => !g.is_demo && g.title !== '日常生活').map(g => <p key={g.id}><Link className="text-emerald-800 underline" to={`/planning?goal_id=${g.id}`}>{g.title}</Link> · {g.decisions[g.decisions.length - 1]?.result || '尚未记录实际进展'}</p>)}
      <p className="text-sm text-slate-600">这些是本机记录的汇总。逾期只说明日期已过，无法据此判断原因。</p>
    </section><form className="life-panel space-y-4 rounded-2xl border bg-white p-5" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await workbenchRequest('/week', week.reflection); setMessage('本周回顾已保存。') } catch { setError('回顾保存失败，请重试。') } finally { setBusy(false) } }}>
      {([['result', '本周哪些行动带来了实际结果？'], ['obstacle', '没完成的事情卡在哪里？'], ['adjustment', '下周准备减少什么、改变什么？']] as const).map(([key, label]) => <label className="block" key={key}>{label}<textarea maxLength={4000} className="mt-2 min-h-24 w-full rounded border p-3" value={week.reflection[key]} onChange={e => setWeek({ ...week, reflection: { ...week.reflection, [key]: e.target.value } })} /></label>)}
      <button disabled={busy}>保存本周回顾</button><Link className="ml-4 text-emerald-800 underline" to="/dashboard">去今天安排调整后的行动</Link>
    </form></>}
    <section className="life-panel space-y-3 rounded-2xl border bg-white p-5"><h2 className="text-xl font-semibold">长期参考</h2><p className="text-sm text-slate-600">你核实后保留的结论。暂不自动发送给 AI，可复制内容到对话中继续讨论。</p>{insights.length === 0 && <p>可在 AI 回答下保存值得保留的结论。</p>}{insights.map(item => <details key={item.id} id={`insight-${item.id}`}><summary className="cursor-pointer font-medium">{item.title}</summary><p className="mt-2 whitespace-pre-wrap break-words">{item.body}</p>{item.goal_id && <Link className="text-emerald-800 underline" to={`/planning?goal_id=${item.goal_id}#decision-${item.experiment_id}`}>回看原判断与验证</Link>}</details>)}</section>
    <section className="life-panel space-y-3 rounded-2xl border bg-white p-5"><h2 className="text-xl font-semibold">数据备份</h2><p className="text-sm leading-6">每天首次启动会创建本地数据库快照；持续运行时可点击备份。备份包含档案、任务、聊天和知识索引，不含 API 密钥与 Obsidian 原文件。下载一份到其他磁盘，可以应对本机磁盘损坏。</p><button disabled={busy} onClick={() => void backup()}>现在备份</button>
      {backups.slice(0, 10).map(b => <p key={b.name}><a className="text-emerald-800 underline" href={backupUrl(b.name)} download>{b.name}</a> · {Math.ceil(b.bytes / 1024)} KB</p>)}
      <p className="text-sm text-slate-600">恢复步骤：停止 Life OS，将下载的备份复制为 data/life_os.db（先另存当前数据库），然后重新启动。</p>
    </section>
    {message && <p role="status" className="text-emerald-800">{message}</p>}
  </div>
}
