import { Link } from 'react-router-dom'
import { DailyTasks } from '../components/DailyTasks'
import { DecisionValidation } from '../components/DecisionValidation'
import { LifeCard } from '../components/LifeCard'
import { InsightCard } from '../components/InsightCard'
import { KnowledgeCard } from '../components/KnowledgeCard'
import { useDashboard } from '../hooks/useDashboard'
import { shanghaiToday } from '../services/personal'

export default function Dashboard() {
  const { data, error, refresh } = useDashboard()
  return <div className="space-y-8">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="mb-2 text-sm text-slate-500">{shanghaiToday()} · 上海时间</p><h1 className="text-3xl font-semibold">今天</h1></div>
      <Link className="text-sm text-emerald-700 underline" to="/companion">与生命伙伴聊聊 →</Link>
    </header>
    <DailyTasks onChange={refresh} />
    <DecisionValidation />
    <details className="life-panel rounded-2xl border border-slate-200 bg-white p-5">
      <summary className="cursor-pointer font-medium">我的近况与知识库</summary>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      {data && <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <LifeCard profile={data.profile} />
        <KnowledgeCard knowledge={data.knowledge} />
        <div className="xl:col-span-2"><p className="mb-2 text-xs text-slate-500">伙伴建议由本地模拟规则生成</p><InsightCard insight={data.ai_insight} suggestions={data.ai_suggestions} status={data.ai_status} /></div>
      </div>}
    </details>
  </div>
}
