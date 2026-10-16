import { Link } from 'react-router-dom'
import { LifeCard } from '../components/LifeCard'
import { TaskCard } from '../components/TaskCard'
import { InsightCard } from '../components/InsightCard'
import { KnowledgeCard } from '../components/KnowledgeCard'
import { useDashboard } from '../hooks/useDashboard'

export default function Dashboard() {
  const { data, error, loading, refresh } = useDashboard()
  return <div className="space-y-6">
    <header className="relative overflow-hidden rounded-2xl bg-slate-900 p-6 text-white sm:p-8"><div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border border-emerald-400/20" /><div aria-hidden="true" className="pointer-events-none absolute -right-6 -top-10 h-44 w-44 rounded-full border border-emerald-400/20" />
      <p className="mb-3 font-mono text-xs tracking-widest text-emerald-300">LIFE OS / PERSONAL LIFE OPERATING SYSTEM</p><div className="relative flex flex-wrap items-end justify-between gap-5"><div><h1 className="text-3xl font-semibold tracking-tight">生命驾驶舱</h1><p className="mt-3 text-sm leading-6 text-slate-300">看见此刻的自己，把重要的事推进一小步。</p></div><div className="text-left sm:text-right"><p className="font-mono text-sm text-slate-300">{data?.current_date ?? '正在连接…'}</p><button className="mt-3 !bg-white/10 hover:!bg-white/20" disabled={loading} onClick={refresh}>{loading ? '正在更新…' : '刷新驾驶舱'}</button></div></div>
    </header>
    {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}{data && ' 以下保留上次成功获取的数据。'}</div>}
    {loading && !data && <p role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">正在汇总档案、任务、伙伴建议和知识索引…</p>}
    {data && <><div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><p>{data.demo_data ? '演示数据 · 任务与复盘为虚构样例' : '个人数据概览'} · 今日按上海时区统计</p><Link className="text-emerald-700 underline" to="/companion">打开生命伙伴 →</Link></div>
      <div className="grid gap-6 xl:grid-cols-2"><LifeCard profile={data.profile} /><TaskCard projects={data.projects} tasks={data.tasks} progress={data.progress} /><InsightCard insight={data.ai_insight} suggestions={data.ai_suggestions} status={data.ai_status} /><KnowledgeCard knowledge={data.knowledge} /></div>
      <section className="rounded-2xl border border-slate-200 bg-white p-6"><div className="mb-5 flex items-center justify-between"><h2 className="font-semibold">成长记录</h2><span className="text-xs text-slate-500">把微小进步留下来</span></div><div className="grid gap-6 lg:grid-cols-2"><div><h3 className="mb-3 text-xs font-medium text-slate-500">最近完成任务</h3><ul className="space-y-3">{data.growth.completed_tasks.length === 0 && <li className="text-sm text-slate-400">还没有完成记录，第一步也值得被看见。</li>}{data.growth.completed_tasks.map(task => <li key={task.id} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3"><span aria-hidden="true" className="text-emerald-700">✓</span><div className="min-w-0"><p className="break-words text-sm leading-6">{task.title}</p><p className="mt-1 text-xs text-slate-500">{task.completed_at ? new Date(task.completed_at).toLocaleString('zh-CN') : '已完成'}</p></div></li>)}</ul></div><div><h3 className="mb-3 text-xs font-medium text-slate-500">最近复盘</h3><div className="space-y-3">{data.growth.reviews.length === 0 && <p className="text-sm text-slate-400">还没有复盘记录。</p>}{data.growth.reviews.map(review => <article key={review.id} className="rounded-xl bg-slate-50 p-4"><p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">{review.content}</p><time className="mt-3 block text-xs text-slate-500">{new Date(review.created_at).toLocaleString('zh-CN')}</time></article>)}</div></div></div></section>
    </>}
  </div>
}
