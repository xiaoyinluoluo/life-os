import { Link } from 'react-router-dom'
import type { ToolProposal, ExecutionResult } from '../services/tools'

const names: Record<string, string> = { create_project: '创建项目', create_task: '创建任务', update_task: '更新任务' }
const fields: Record<string, string> = { goal_id: '归属目标 ID', project_id: '项目 ID', task_id: '任务 ID', title: '名称', description: '说明', priority: '优先级', due_date: '截止日期', status: '任务状态' }
export function ToolExecutionCard({ proposal, result, busy, onConfirm, onCancel }: { proposal: ToolProposal; result: ExecutionResult | null; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  return <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><h2 className="mb-3 font-semibold">{result ? result.message : '即将执行的行动方案'}</h2>
    <ul className="mb-4 space-y-2 text-sm text-emerald-800"><li>✓ 读取个人档案</li><li>✓ 搜索个人知识索引</li><li>✓ 分析目标（本地模拟编排）</li></ul>
    <p className="mb-4 whitespace-pre-wrap break-words text-sm leading-7">{proposal.analysis}</p><p className="mb-3 text-sm font-medium">{proposal.summary}</p>
    <ol className="space-y-3">{proposal.operations.map((operation, index) => <li key={index} className="rounded-xl bg-white p-3"><h3 className="mb-2 text-sm font-medium">{result ? '✓ ' : `${index + 1}. `}{names[operation.tool_name] ?? operation.tool_name}</h3><dl className="space-y-1 text-xs leading-6 text-slate-600">{Object.entries(operation.arguments).map(([key, value]) => <div key={key} className="flex gap-2"><dt className="shrink-0">{fields[key] ?? key}：</dt><dd className="min-w-0 break-words">{value === '$created_project' ? '上方新建的项目' : value === null ? '清空' : String(value)}</dd></div>)}</dl></li>)}</ol>
    {proposal.status === 'pending' && !result && <><p className="my-4 text-xs leading-6 text-slate-600">目前还没有创建或修改项目、任务。确认后按以上内容一次性执行；方案有效至 {new Date(proposal.expires_at).toLocaleString('zh-CN')}。</p><div className="flex flex-wrap gap-3"><button disabled={busy} onClick={onConfirm}>{busy ? '处理中…' : '确认执行以上操作'}</button><button className="!bg-slate-600 hover:!bg-slate-700" disabled={busy} onClick={onCancel}>取消方案</button></div></>}
    {proposal.status === 'cancelled' && <p role="status" className="mt-4 text-sm text-slate-600">方案已取消，未修改任何项目或任务。</p>}
    {(proposal.status === 'failed' || proposal.status === 'expired') && <p role="status" className="mt-4 text-sm text-amber-800">{proposal.status === 'expired' ? '方案已过期。' : '执行未完成，项目和任务变更已全部回滚。'}可以重新生成方案，再次核对并确认。</p>}
    {result && <div role="status" className="mt-4"><p className="mb-3 text-sm text-emerald-800">✓ 创建项目 {result.project_id ? '1' : '0'} 个 · ✓ 创建任务 {result.task_ids.length} 个</p><Link className="inline-block rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white" to={result.plan_url}>查看计划 →</Link></div>}
  </section>
}
