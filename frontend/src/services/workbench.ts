const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '') + '/api/workbench'
export const backupUrl = (name: string) => `${base}/backups/${encodeURIComponent(name)}`
export async function workbenchRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(base + path, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error('工作台保存或加载失败，请重试。')
  return response.json()
}
export type DayPlan = { minutes: number; estimates: Record<string, number> }
