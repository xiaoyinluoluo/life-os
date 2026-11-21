import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Card } from '../components/Card'
import { PageHeading } from '../components/PageHeading'
import { CompanionReplyCard } from '../components/CompanionReplyCard'
import { useCompanionChat } from '../hooks/useCompanionChat'
import { useToolAction } from '../hooks/useToolAction'
import { ToolExecutionCard } from '../components/ToolExecutionCard'
import { personalRequest, type PersonalGoal, type PersonalTask } from '../services/personal'
import type { ChatAttachment, Provider } from '../services/companion'
import { knowledgeApi } from '../services/knowledge'
import { ActionDraft } from '../components/ActionDraft'
import { SaveInsight } from '../components/SaveInsight'

type AttachmentOption = { key: string; title: string; excerpt: string; value: ChatAttachment }

export default function Companion() {
  const location = useLocation()
  const initialDecisionDraft = typeof location.state?.decisionDraft === 'string' ? location.state.decisionDraft : ''
  const [draft, setDraft] = useState(initialDecisionDraft.slice(0, 4000))
  const [action, setAction] = useState<{ text: string; key: string } | null>(null)
  const [noteSearch, setNoteSearch] = useState('')
  const { provider, changeProvider, conversation, checking, loading, error, send, clear, load } = useCompanionChat()
  const providerNames = { openai: 'GPT', deepseek: 'DeepSeek', doubao: '豆包' }
  const providerServices = { openai: 'OpenAI', deepseek: 'DeepSeek', doubao: '火山方舟' }
  const providerKeys = { openai: 'OPENAI_API_KEY', deepseek: 'DEEPSEEK_API_KEY', doubao: 'ARK_API_KEY' }
  const [options, setOptions] = useState<AttachmentOption[] | null>(null)
  const [attachmentKey, setAttachmentKey] = useState('')
  const [attachmentError, setAttachmentError] = useState('')
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const tools = useToolAction()
  const busy = checking || loading || tools.busy
  const attachment = options?.find(option => option.key === attachmentKey)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [conversation?.turns, loading])

  async function showAttachments() {
    setAttachmentError('')
    setLoadingOptions(true)
    try {
      const [goals, tasks, notes, profile, workspace] = await Promise.all([
        personalRequest<PersonalGoal[]>('/goals'),
        personalRequest<PersonalTask[]>('/tasks'),
        knowledgeApi.files(0, false),
        personalRequest<{ background: string; name: string; skills: string[]; interests: string[]; values: string[]; goals: string[] }>('/profile'),
        personalRequest<{ mode: string }>('/workspace'),
      ])
      while (notes.items.length < notes.total) {
        const page = await knowledgeApi.files(notes.items.length, false)
        if (!page.items.length) break
        notes.items.push(...page.items)
      }
      setOptions([
        ...(workspace.mode === 'personal' ? [{ key: 'profile-1', title: '个人档案', excerpt: JSON.stringify(profile, null, 2), value: { kind: 'profile' as const, id: 1 } }] : []),
        ...notes.items.filter(note => note.status === 'active').map(note => ({
          key: `note-${note.id}`, title: `笔记摘要 · ${note.file_name}`, excerpt: `${note.file_path}\n${note.summary}`,
          value: { kind: 'note' as const, id: note.id },
        })),
        ...goals.filter(goal => !goal.is_demo).map(goal => ({
          key: `goal-${goal.id}`, title: `目标 · ${goal.title}`, excerpt: goal.outcome,
          value: { kind: 'goal' as const, id: goal.id },
        })),
        ...tasks.filter(task => task.review && !task.is_demo).map(task => ({
          key: `review-${task.id}`, title: `复盘 · ${task.title}`, excerpt: task.review,
          value: { kind: 'review' as const, id: task.id },
        })),
      ])
    } catch {
      setAttachmentError('资料加载失败，请检查知识库和个人资料服务后重试。')
    } finally {
      setLoadingOptions(false)
    }
  }

  return <><PageHeading title="AI 生命伙伴" description="聊聊你的问题，从理解自己到迈出下一步。" />
    <label className="mb-4 block text-sm font-medium">选择 AI
      <select className="ml-3 rounded-lg border border-slate-300 bg-white p-2" value={provider} disabled={busy}
        onChange={event => { changeProvider(event.target.value as Provider); setAttachmentKey(''); setConfirmClear(false) }}>
        <option value="openai">GPT</option><option value="deepseek">DeepSeek</option><option value="doubao">豆包</option>
      </select>
    </label>
    {checking ? <p className="mb-5 text-sm text-slate-500">正在读取聊天设置…</p> : conversation?.configured ?
      <p className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
        <strong>{providerNames[provider]} · {conversation.model}</strong>。发送时，当前消息、最近六轮对话和本轮选附资料会发给 {providerServices[provider]}。完整对话保存在本机；AI 每次只接收最近六轮，较早结论需要重新选附。
      </p> : conversation && <p className="mb-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        {providerNames[provider]} 待配置。填写后端的 {providerKeys[provider]} 并重启 Life OS。
      </p>}
    <Card title="与 Life Companion 对话">
      {Boolean(conversation?.turns.length) && <div className="mb-4 flex flex-wrap items-center gap-2">
        {confirmClear ? <>
          <p className="text-sm text-slate-600">清空本机保存的 {providerNames[provider]} 对话？</p>
          <button type="button" disabled={busy} onClick={() => void clear().then(success => { if (success) setConfirmClear(false) })}>确认清空</button>
          <button type="button" className="!bg-slate-100 !text-slate-700" onClick={() => setConfirmClear(false)}>取消</button>
        </> : <button type="button" className="!bg-slate-100 !text-slate-700" disabled={busy} onClick={() => setConfirmClear(true)}>清空当前 AI 对话</button>}
      </div>}
      <div role="log" aria-label="聊天消息" aria-live="polite" className="mb-5 max-h-[60vh] min-h-40 space-y-4 overflow-y-auto">
        {!conversation?.turns.length && <p className="rounded-xl bg-slate-50 p-5 text-sm leading-7 text-slate-600">你好，我是你的生命伙伴。可以聊聊学习方向、工作困惑，或者最近的压力。</p>}
        {conversation?.turns.map(turn => <div key={turn.id} className="space-y-3">
          <article className="ml-8 rounded-2xl bg-slate-100 p-4">
            <p className="mb-2 text-xs text-slate-500">你{turn.attachment && ` · 附上：${turn.attachment}`}</p>
            <p className="whitespace-pre-wrap break-words text-sm leading-7">{turn.message}</p>
          </article>
          <CompanionReplyCard reply={turn.reply} model={turn.model} onAction={(text, index) => setAction({ text, key: `${turn.id}:${index}` })} />
          <SaveInsight text={`${turn.reply.analysis}\n\n${turn.reply.suggestions.join('\n')}`} />
          {action?.key.startsWith(turn.id + ':') && <ActionDraft key={action.key} text={action.text} sourceKey={action.key} close={() => setAction(null)} />}
        </div>)}
        {loading && <p role="status" className="text-sm text-emerald-700">正在处理…</p>}
        <div ref={end} />
      </div>
      {error && <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error} {draft && '输入已保留。'} <button type="button" className="!bg-transparent !p-0 !text-red-800 underline" onClick={load}>重新读取对话</button></div>}
      {tools.error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{tools.error} 若确认请求中断，可再次确认同一方案，后端会防止重复创建。</p>}
      {tools.phase && <p role="status" className="mb-4 text-sm text-emerald-800">{tools.phase}</p>}
      <form onSubmit={event => { event.preventDefault(); void send(draft, attachment?.value ?? null).then(success => {
        if (success) { setDraft(''); setAttachmentKey('') }
      }) }}>
        <label htmlFor="companion-message" className="mb-2 block text-sm font-medium">想和伙伴聊什么？</label>
        {initialDecisionDraft.length > 4000 && <p className="mb-2 text-amber-800">决定资料超过消息长度，草稿已截取前 4000 字。请检查并精简后发送。</p>}
        <textarea id="companion-message" maxLength={4000} disabled={busy} value={draft} onChange={event => setDraft(event.target.value)} placeholder="例如：我想参加 AI Agent 比赛，帮我规划一下。" className="min-h-28 w-full resize-y rounded-xl border border-slate-300 p-3 text-sm leading-6 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50" />
        {conversation?.configured && <div className="mt-3">
          {options === null ? <button type="button" className="!bg-slate-100 !text-slate-700" disabled={busy || loadingOptions} onClick={() => void showAttachments()}>{loadingOptions ? '读取资料…' : '选择笔记、档案、目标或复盘'}</button> :
            <label className="block text-sm">本轮附上的资料
              <select className="mt-1 w-full rounded-lg border border-slate-300 p-2" disabled={busy} value={attachmentKey} onChange={event => setAttachmentKey(event.target.value)}>
                <option value="">不附加资料</option>
                {options.filter(option => option.key === attachmentKey || option.title.includes(noteSearch)).map(option => <option key={option.key} value={option.key}>{option.title}</option>)}
              </select>
            </label>}
          {options && <div className="mt-2"><label className="block text-sm">筛选资料<input className="ml-2 rounded border p-2" value={noteSearch} onChange={e => setNoteSearch(e.target.value)} /></label><button type="button" disabled={loadingOptions || busy} className="mt-2 !bg-slate-100 !text-slate-700" onClick={() => void showAttachments()}>刷新资料</button></div>}
          {attachment?.excerpt && <div className="mt-2 rounded-lg bg-amber-50 p-3 text-sm"><p className="font-medium">本次将随消息发送给 {providerServices[provider]} 的资料：</p><p className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words">{attachment.excerpt}</p><p className="mt-2">笔记仅发送已索引摘要，可能不是全文；请先在知识库同步最新内容。</p></div>}
          {options?.length === 0 && <p className="mt-2 text-sm text-slate-500">还没有可附加的个人目标或任务复盘。</p>}
          {attachmentError && <p role="alert" className="mt-2 text-sm text-red-700">{attachmentError}</p>}
        </div>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-slate-500">{draft.length}/4000 · Enter 换行</span><button type="submit" disabled={busy || !conversation?.configured || !draft.trim()}>{loading ? '正在处理…' : `发送给 ${providerNames[provider]}`}</button></div>
      </form>
      <details className="mt-5 border-t border-slate-200 pt-5"><summary className="mb-3 cursor-pointer text-sm">本地模板规划（固定五步，适合试用）</summary><label htmlFor="tool-goal" className="mb-2 block text-sm font-medium">行动项目的归属目标</label><select id="tool-goal" className="mb-3 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm" value={tools.goalId} disabled={busy || tools.proposal?.status === 'pending'} onChange={event => tools.setGoalId(event.target.value)}>{tools.goals.length === 0 && <option value="">暂无可用目标</option>}{tools.goals.map(goal => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select><button disabled={busy || !draft.trim() || !tools.goalId || tools.proposal?.status === 'pending'} onClick={() => void tools.preview(draft)}>规划并预览行动</button><p className="mt-2 text-xs leading-6 text-slate-500">先在上方输入目标，再预览创建 1 个项目和 5 个任务。必须明确确认后才写入业务数据。真实 AI 建议请使用回答中的“加入计划”。</p></details>
      {tools.proposal && <ToolExecutionCard proposal={tools.proposal} result={tools.result} busy={busy} onConfirm={() => void tools.confirm()} onCancel={() => void tools.cancel()} />}
    </Card>
  </>
}
