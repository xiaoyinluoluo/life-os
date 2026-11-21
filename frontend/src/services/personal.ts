export type PersonalTask = {
  id: number
  title: string
  status: string
  due_date: string | null
  is_demo: boolean
  review: string
  project_id: number
  goal_id: number
  goal_title: string
  goal_status: GoalStatus
  focus_date: string | null
  archived: boolean
}
export type GoalStatus = 'active' | 'paused' | 'completed'
export type PersonalGoal = {
  id: number
  title: string
  status: GoalStatus
  outcome: string
  decisions: { status: GoalStatus; note: string; result?: string; at: string }[]
  is_demo: boolean
}
export type OrganizeAction = 'today' | 'unschedule' | 'archive' | 'restore' | 'focus' | 'unfocus'

export function organizeTasks(ids: number[], action: OrganizeAction) {
  return personalRequest<PersonalTask[]>('/tasks/organize', { ids, action })
}
export type Workspace = { mode: 'pending' | 'personal' | 'demo'; name: string }
const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '') + '/api/personal'

export async function personalRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(base + path, body === undefined ? {} : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const result = await response.json().catch(() => null)
    throw new Error(typeof result?.detail === 'string' ? result.detail : '保存失败，请检查输入后重试。')
  }
  return response.json() as Promise<T>
}

export function shanghaiToday() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date())
}
