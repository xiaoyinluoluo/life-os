import type { DashboardData } from '../services/dashboard'

export function LifeCard({ profile }: { profile: DashboardData['profile'] }) {
  return <section className="h-full rounded-2xl border border-slate-200 bg-white p-6"><div className="mb-5 flex items-center justify-between"><h2 className="font-semibold">个人生命状态</h2><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-800">{profile.current_stage}</span></div>
    <p className="text-2xl font-semibold tracking-tight">你好，{profile.name}。</p>
    <div className="my-5 border-l-2 border-emerald-600 pl-4"><p className="mb-2 text-xs text-slate-500">核心目标</p><p className="break-words text-lg leading-7">{profile.core_goal}</p></div>
    <div className="rounded-xl bg-slate-50 p-4"><p className="mb-2 text-xs text-slate-500">最近状态</p><p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{profile.recent_status}</p></div>
  </section>
}
