import type { DashboardData } from '../services/dashboard'

const statusText = { todo: '待开始', in_progress: '进行中', done: '已完成' }
export function TaskCard({ projects, tasks, progress }: Pick<DashboardData, 'projects' | 'tasks' | 'progress'>) {
  const activeProjects = projects.filter(project => project.status === 'active')
  return <section className="h-full rounded-2xl border border-slate-200 bg-white p-6"><div className="mb-5 flex items-center justify-between"><h2 className="font-semibold">今日重点</h2><span className="font-mono text-sm text-emerald-700">{progress.completed}/{progress.total}</span></div>
    <p className="text-xs text-slate-500">当前项目 · {activeProjects.length} 个</p><p className="mb-5 mt-2 break-words text-sm font-medium leading-6">{activeProjects.map(project => project.title).join(' / ') || '暂无进行中的项目'}</p>
    <div className="mb-2 flex justify-between text-xs text-slate-500"><span>今日任务完成进度</span><span>{progress.percentage}%</span></div>
    <div role="progressbar" aria-label="今日任务完成进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percentage} className="mb-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${progress.percentage}%` }} /></div>
    <ul className="space-y-3">{tasks.length === 0 && <li className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">今天还没有安排任务，给自己留一点空间。</li>}{tasks.map(task => <li key={task.id} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3"><span aria-hidden="true" className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${task.status === 'done' ? 'bg-emerald-600 text-white' : 'border border-slate-300 text-slate-500'}`}>{task.status === 'done' ? '✓' : task.status === 'in_progress' ? '•' : ''}</span><div className="min-w-0 flex-1"><p className={`break-words text-sm leading-6 ${task.status === 'done' ? 'text-slate-400 line-through' : ''}`}>{task.title}</p><p className="mt-1 text-xs text-slate-500">{statusText[task.status]} · {projects.find(project => project.id === task.project_id)?.title ?? '项目'}</p></div></li>)}</ul>
  </section>
}
