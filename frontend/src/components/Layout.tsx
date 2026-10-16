import { NavLink, Outlet } from 'react-router-dom'

const navigation = [['/dashboard', '生命驾驶舱'], ['/companion', 'AI 生命伙伴'], ['/planning', '行动计划'], ['/knowledge', '知识库']]
export function Layout() {
  return <div className="min-h-screen">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5"><NavLink to="/dashboard" className="text-2xl font-bold tracking-tight">Life <span className="text-emerald-700">OS</span></NavLink><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-800">v0.1 · 生命驾驶舱</span></div></header>
    <div className="mx-auto grid max-w-6xl gap-8 px-6 py-8 md:grid-cols-[180px_1fr]">
      <nav aria-label="主导航" className="flex flex-wrap content-start gap-2 md:flex-col">{navigation.map(([to, label]) => <NavLink key={to} to={to} className={({ isActive }) => `rounded-xl px-4 py-3 text-sm ${isActive ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</NavLink>)}</nav>
      <main className="min-w-0"><Outlet /></main>
    </div>
    <footer className="px-6 py-8 text-center text-xs text-slate-500">Personal Life Operating System · 从了解自己开始</footer>
  </div>
}
