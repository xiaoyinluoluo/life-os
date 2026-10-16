import { Link } from 'react-router-dom'
import type { DashboardData } from '../services/dashboard'

export function KnowledgeCard({ knowledge }: { knowledge: DashboardData['knowledge'] }) {
  return <section className="h-full rounded-2xl border border-slate-200 bg-white p-6"><div className="mb-5 flex items-center justify-between"><h2 className="font-semibold">知识库状态</h2><span className={`rounded-full px-3 py-1 text-xs ${knowledge.connected ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{knowledge.connected ? 'Vault 已连接' : 'Vault 未连接'}</span></div>
    <div className="mb-5 flex items-baseline gap-2"><span className="font-mono text-5xl font-medium tracking-tight">{knowledge.files_count}</span><span className="text-sm text-slate-500">篇已索引笔记</span></div>
    <dl className="space-y-2 text-sm"><div className="flex flex-wrap justify-between gap-2"><dt className="text-slate-500">最近同步</dt><dd>{knowledge.last_sync ? new Date(knowledge.last_sync).toLocaleString('zh-CN') : '尚未同步'}</dd></div><div className="flex justify-between gap-2"><dt className="text-slate-500">同步状态</dt><dd>{knowledge.sync_status === 'partial' ? '部分成功，请检查文件' : knowledge.sync_status === 'ok' ? '同步成功' : '等待首次同步'}</dd></div></dl>
    <p className="mt-5 rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-500">只读索引 · 笔记保留在本机。同步后，伙伴会参考相关摘要。</p>
    <Link to="/knowledge" className="mt-5 inline-block text-sm font-semibold text-emerald-700 underline underline-offset-4">管理知识库 →</Link>
  </section>
}
