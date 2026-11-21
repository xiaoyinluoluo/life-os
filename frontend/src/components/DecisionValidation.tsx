import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { workbenchRequest } from '../services/workbench'
import { shanghaiToday } from '../services/personal'

type Decision = {
  id: string; goal_id: number; goal_title: string; choice: string; reconsider: string;
  evidence: string; experiment: string; due_date: string | null; task_id: number | null;
  status: 'open' | 'resolved'; result: string; outcome: string | null; insight_id: string | null
}
const field = 'mt-1 w-full rounded-lg border border-slate-300 bg-white p-3'
const outcomes: Record<string, string> = { continue: '继续', shrink: '缩小范围', pause: '暂停验证', finish: '结束验证' }

function DecisionItem({ item, saved }: { item: Decision; saved: () => void }) {
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState('')
  const [outcome, setOutcome] = useState('continue')
  const [keep, setKeep] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [date, setDate] = useState(item.due_date || '')
  const context = `目标：${item.goal_title}\n当前判断：${item.choice}\n改变主意的条件：${item.reconsider}\n依据：${item.evidence}\n最小验证：${item.experiment}\n实际结果：${item.result}`
  return <article id={`decision-${item.id}`} className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
    <p className="font-medium whitespace-pre-wrap break-words">{item.choice}</p>
    <p className="whitespace-pre-wrap break-words">改变主意的条件：{item.reconsider}</p>
    {item.evidence && <details><summary className="cursor-pointer">判断依据</summary><p className="mt-2 whitespace-pre-wrap break-words">{item.evidence}</p></details>}
    {item.experiment && <p className="break-words">最小验证：{item.experiment} · <Link className="text-emerald-800 underline" to="/dashboard">查看待办</Link></p>}
    <p className="text-sm text-slate-600">{item.status === 'resolved' ? `已复盘 · ${outcomes[item.outcome || '']}` : item.due_date ? `${item.due_date <= shanghaiToday() ? '已到验证日期' : '计划回看'} · ${item.due_date}` : '待验证 · 尚未设置回看日期'}</p>
    {item.status === 'open' && <details><summary className="cursor-pointer text-sm">调整回看日期</summary><form className="mt-2 space-y-2" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError('')
      try { await workbenchRequest(`/experiments/${item.id}/schedule`, { due_date: date || null }); saved() }
      catch { setError('日期保存失败，请重试。') } finally { setBusy(false) }
    }}><label className="block">回看日期<input type="date" className={field} value={date} onChange={e => setDate(e.target.value)} onInput={e => setDate(e.currentTarget.value)} /></label><p className="text-sm text-slate-600">留空可取消提醒；只调整回看日期，待办时间可在今天页修改。</p><button disabled={busy}>保存回看日期</button></form></details>}
    {item.status === 'resolved' && <><p className="whitespace-pre-wrap break-words">实际结果：{item.result}</p>{item.insight_id && <Link className="text-emerald-800 underline" to={`/review#insight-${item.insight_id}`}>查看保存的长期参考</Link>}</>}
    <details><summary className="cursor-pointer text-sm text-emerald-800">让 AI 帮我想一想</summary><p className="my-2 text-sm">将带上本卡片内容进入草稿，确认后才发送。</p><div className="flex flex-wrap gap-3">{[
      ['质疑判断', '请质疑我的判断，指出缺少的证据和其他解释，不要把推测当成事实。'],
      ['设计验证', '请设计一个低成本、可观察结果的小实验，列出判断标准。'],
      ['复盘结果', '请对照原判断分析实际结果，区分观察与推断，帮助我决定下一步。'],
    ].map(([label, instruction]) => <Link key={label} className="text-emerald-800 underline" to="/companion" state={{ decisionDraft: `${instruction}\n\n${context}` }}>{label}</Link>)}</div></details>
    {item.status === 'open' && <button type="button" onClick={() => setOpen(!open)}>{open ? '收起' : '记录验证结果'}</button>}
    {open && <form className="space-y-3" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError('')
      try { await workbenchRequest(`/experiments/${item.id}/resolve`, { result, outcome, keep_insight: keep }); setOpen(false); saved() }
      catch { setError('结果保存失败，输入已保留，请重试。') } finally { setBusy(false) }
    }}>
      <label className="block">实际发生了什么？<textarea required maxLength={4000} className={field} value={result} onChange={e => setResult(e.target.value)} /></label>
      <label className="block">这次验证之后<select className={field} value={outcome} onChange={e => setOutcome(e.target.value)}>{Object.entries(outcomes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <p className="text-sm text-slate-600">这里记录本次验证的选择。若需暂停或结束整个目标，请使用目标的“记录调整”。</p>
      <label className="flex items-start gap-2"><input type="checkbox" checked={keep} onChange={e => setKeep(e.target.checked)} />我已核实，保存为长期参考</label>
      <button disabled={busy || !result.trim()}>保存验证结果</button>
    </form>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </article>
}

export function DecisionValidation({ goalId, canCreate, changed }: { goalId?: number; canCreate?: boolean; changed?: () => void }) {
  const location = useLocation()
  const [items, setItems] = useState<Decision[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [choice, setChoice] = useState('')
  const [reconsider, setReconsider] = useState('')
  const [evidence, setEvidence] = useState('')
  const [experiment, setExperiment] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function refresh() {
    setError('')
    try { setItems(await workbenchRequest<Decision[]>('/experiments')) }
    catch { setError('决定与验证加载失败，请重试。') } finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [goalId])
  useEffect(() => {
    if (location.hash.startsWith('#decision-')) document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'center' })
  }, [items, location.hash])
  const visible = items.filter(item => goalId ? item.goal_id === goalId : item.status === 'open' && item.due_date && item.due_date <= shanghaiToday())
    .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'))
  return <section className="life-panel space-y-4 rounded-xl border border-slate-200 bg-white p-4" aria-label="决定与验证">
    <h3 className="text-lg font-semibold">{goalId ? '决定与验证' : '到期的决定，回头看看'}</h3>
    {loading && <p role="status">正在读取…</p>}
    {error && <p role="alert" className="text-red-700">{error} <button type="button" onClick={() => void refresh()}>重试</button></p>}
    {!loading && !error && visible.length === 0 && <p className="text-slate-600">{goalId ? '写下当前判断，再用实际结果检验它。' : '暂无到期验证。可在目标中写下判断和回看日期。'}</p>}
    {visible.map(item => goalId ? <DecisionItem key={item.id} item={item} saved={() => { void refresh(); changed?.() }} /> :
      <p key={item.id} className="break-words"><Link className="text-emerald-800 underline" to={`/planning?goal_id=${item.goal_id}#decision-${item.id}`}>{item.goal_title} · {item.choice}</Link><span className="ml-2 text-sm text-slate-600">{item.due_date}</span></p>)}
    {goalId && canCreate && <button type="button" className="!bg-slate-100 !text-slate-700" onClick={() => setOpen(!open)}>{open ? '收起新判断' : '写下一个判断'}</button>}
    {open && <form className="space-y-4" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError(''); setMessage('')
      try {
        await workbenchRequest('/experiments', { goal_id: goalId, choice, reconsider, evidence, experiment, due_date: dueDate || null, request_id: requestId })
        setOpen(false); setChoice(''); setReconsider(''); setEvidence(''); setExperiment(''); setDueDate(''); setRequestId(crypto.randomUUID())
        setMessage(experiment.trim() ? '判断已保存，最小验证已加入该目标的待办。' : '判断已保存。'); await refresh(); changed?.()
      } catch { setError('保存失败，输入已保留，请重试。') } finally { setBusy(false) }
    }}>
      <label className="block">我现在倾向怎么做？<textarea required maxLength={2000} className={field} value={choice} onChange={e => setChoice(e.target.value)} /></label>
      <label className="block">发生什么会让我改变主意？<textarea required maxLength={2000} className={field} value={reconsider} onChange={e => setReconsider(e.target.value)} /></label>
      <details><summary className="cursor-pointer">补充依据和最小验证（可选）</summary><div className="mt-3 space-y-4">
        <label className="block">依据、笔记链接或观察记录<textarea maxLength={4000} className={field} value={evidence} onChange={e => setEvidence(e.target.value)} placeholder="哪些是事实，哪些还只是猜测？可粘贴 Obsidian 笔记链接。" /></label>
        <label className="block">先做一个小验证<input maxLength={300} className={field} value={experiment} onChange={e => setExperiment(e.target.value)} placeholder="保存后加入这个目标的待办" /></label>
      </div></details>
      <label className="block">什么时候回头看看？（可选）<input type="date" className={field} value={dueDate} onChange={e => setDueDate(e.target.value)} onInput={e => setDueDate(e.currentTarget.value)} /></label>
      <button disabled={busy || !choice.trim() || !reconsider.trim()}>保存判断{experiment.trim() ? '并添加验证待办' : ''}</button>
    </form>}
    {message && <p role="status" className="text-emerald-800">{message}</p>}
  </section>
}
