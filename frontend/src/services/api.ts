export interface Health {
  status: 'ok' | 'degraded'
  application: string
  version: string
  database: 'connected' | 'unavailable'
  ai_provider: string
}

const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
export const companionChatUrl = baseUrl === '/api' ? '/api/companion/chat' : `${baseUrl}/api/companion/chat`
export const obsidianApiUrl = baseUrl === '/api' ? '/api/obsidian' : `${baseUrl}/api/obsidian`
export const dashboardApiUrl = baseUrl === '/api' ? '/api/dashboard' : `${baseUrl}/api/dashboard`
export async function getHealth(signal?: AbortSignal): Promise<Health> {
  const response = await fetch(`${baseUrl}/health`, { signal })
  if (!response.ok) throw new Error(`后端连接失败（HTTP ${response.status}），请检查服务是否启动。`)
  return response.json() as Promise<Health>
}
