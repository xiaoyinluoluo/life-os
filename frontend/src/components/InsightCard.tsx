import { Link } from 'react-router-dom'
import type { DashboardData } from '../services/dashboard'

export function InsightCard({ insight, suggestions, status }: { insight: string; suggestions: string[]; status: DashboardData['ai_status'] }) {
  return <section className="h-full rounded-2xl border border-emerald-200 bg-emerald-50 p-6"><div className="mb-5 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold text-emerald-950">AI 生命伙伴建议</h2><span className="rounded-full bg-white px-3 py-1 text-xs text-emerald-800">{status === 'ok' ? '本地模拟 AI' : '建议暂不可用'}</span></div>
    <p className="mb-2 text-xs text-emerald-800">当前洞察</p><p className="whitespace-pre-wrap break-words text-sm leading-7 text-emerald-950">{insight}</p>
    <p className="mb-2 mt-5 text-xs text-emerald-800">下一步建议</p><ol className="space-y-2 text-sm leading-6 text-emerald-950">{suggestions.map((item, index) => <li key={index} className="flex gap-2"><span className="font-mono text-emerald-700">0{index + 1}</span><span className="break-words">{item}</span></li>)}</ol>
    <Link className="mt-5 inline-block text-sm font-semibold text-emerald-800 underline underline-offset-4" to="/companion">和伙伴继续聊 →</Link>
  </section>
}
