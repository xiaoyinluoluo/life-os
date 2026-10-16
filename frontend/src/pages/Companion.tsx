import { useEffect, useRef, useState } from 'react'
import { Card } from '../components/Card'
import { PageHeading } from '../components/PageHeading'
import { CompanionReplyCard } from '../components/CompanionReplyCard'
import { useCompanionChat } from '../hooks/useCompanionChat'
import { useToolAction } from '../hooks/useToolAction'
import { ToolExecutionCard } from '../components/ToolExecutionCard'

export default function Companion() {
  const [draft, setDraft] = useState('')
  const { messages, loading, error, send } = useCompanionChat()
  const tools = useToolAction()
  const busy = loading || tools.busy
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [messages, loading])
  return <><PageHeading title="AI 生命伙伴" description="聊聊你的问题，从理解自己到迈出下一步。" />
    <p className="mb-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">当前使用虚构演示档案和本地模拟模型，未接入真实 AI。对话暂存于当前页面，离开或刷新后清空。</p>
    <Card title="与 Life Companion 对话">
      <div role="log" aria-label="聊天消息" aria-live="polite" className="mb-5 max-h-[60vh] min-h-40 space-y-4 overflow-y-auto">
        {messages.length === 0 && <p className="rounded-xl bg-slate-50 p-5 text-sm leading-7 text-slate-600">你好，我是你的生命伙伴。可以聊聊学习方向、工作困惑，或者最近的压力。我们从一个小问题开始。</p>}
        {messages.map(entry => entry.role === 'user' ? <article key={entry.id} className="ml-8 rounded-2xl bg-slate-100 p-4"><p className="mb-2 text-xs text-slate-500">你</p><p className="whitespace-pre-wrap break-words text-sm leading-7">{entry.content}</p></article> : <CompanionReplyCard key={entry.id} reply={entry.reply} />)}
        {loading && <p role="status" className="text-sm text-emerald-700">伙伴正在结合档案整理建议…</p>}
        <div ref={end} />
      </div>
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error} 输入已保留，可以重新发送。</p>}
      {tools.error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{tools.error} 若确认请求中断，可再次确认同一方案，后端会防止重复创建。</p>}
      {tools.phase && <p role="status" className="mb-4 text-sm text-emerald-800">{tools.phase}</p>}
      <form onSubmit={event => { event.preventDefault(); void send(draft).then(success => { if (success) setDraft('') }) }}>
        <label htmlFor="companion-message" className="mb-2 block text-sm font-medium">想和伙伴聊什么？</label>
        <textarea id="companion-message" maxLength={4000} disabled={busy} value={draft} onChange={event => setDraft(event.target.value)} placeholder="例如：我想参加 AI Agent 比赛，帮我规划一下。" className="min-h-28 w-full resize-y rounded-xl border border-slate-300 p-3 text-sm leading-6 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50" />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-slate-500">{draft.length}/4000 · Enter 换行</span><button type="submit" disabled={busy || !draft.trim()}>{loading ? '正在回复…' : '只获取聊天建议'}</button></div>
      </form>
      <div className="mt-5 border-t border-slate-200 pt-5"><label htmlFor="tool-goal" className="mb-2 block text-sm font-medium">行动项目的归属目标</label><select id="tool-goal" className="mb-3 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm" value={tools.goalId} disabled={busy || tools.proposal?.status === 'pending'} onChange={event => tools.setGoalId(event.target.value)}>{tools.goals.length === 0 && <option value="">暂无可用目标</option>}{tools.goals.map(goal => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select><button disabled={busy || !draft.trim() || !tools.goalId || tools.proposal?.status === 'pending'} onClick={() => void tools.preview(draft)}>规划并预览行动</button><p className="mt-2 text-xs leading-6 text-slate-500">先在上方输入目标，再预览创建 1 个项目和 5 个任务。必须明确确认后才写入业务数据。</p></div>
      {tools.proposal && <ToolExecutionCard proposal={tools.proposal} result={tools.result} busy={busy} onConfirm={() => void tools.confirm()} onCancel={() => void tools.cancel()} />}
    </Card>
  </>
}
