import { companionChatUrl } from './api'

export interface CompanionReply {
  analysis: string
  suggestions: string[]
  next_actions: string[]
}

export async function chatWithCompanion(message: string, signal: AbortSignal): Promise<CompanionReply> {
  const response = await fetch(companionChatUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }), signal,
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(typeof payload?.detail === 'string' ? payload.detail : `发送失败（HTTP ${response.status}），请检查后端服务。`)
  }
  const result = await response.json()
  if (!result || typeof result.analysis !== 'string' || !Array.isArray(result.suggestions) || !Array.isArray(result.next_actions)
    || !result.suggestions.every((item: unknown) => typeof item === 'string')
    || !result.next_actions.every((item: unknown) => typeof item === 'string')) {
    throw new Error('伙伴返回了无法显示的内容，请重试。')
  }
  return result as CompanionReply
}
