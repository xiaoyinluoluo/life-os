import { dashboardApiUrl } from './api'

export interface DashboardTask { id: number; project_id: number; title: string; status: 'todo' | 'in_progress' | 'done'; due_date: string | null; completed_at: string | null; is_demo: boolean }
export interface DashboardData {
  profile: { id: number; name: string; current_stage: string; core_goal: string; recent_status: string }
  goals: { id: number; title: string; status: string; is_demo: boolean }[]
  projects: { id: number; goal_id: number; title: string; status: string; is_demo: boolean }[]
  tasks: DashboardTask[]
  ai_insight: string; ai_suggestions: string[]; ai_status: string; ai_provider: string
  knowledge: { files_count: number; last_sync: string; connected: boolean; sync_status: string | null }
  progress: { total: number; completed: number; percentage: number }
  growth: { completed_tasks: DashboardTask[]; reviews: { id: number; content: string; created_at: string; is_demo: boolean }[] }
  current_date: string; timezone: string; demo_data: boolean
}

export async function getDashboard(signal: AbortSignal): Promise<DashboardData> {
  const response = await fetch(dashboardApiUrl, { signal })
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(typeof error?.detail === 'string' ? error.detail : `驾驶舱连接失败（HTTP ${response.status}），请确认后端已启动。`)
  }
  return response.json() as Promise<DashboardData>
}
