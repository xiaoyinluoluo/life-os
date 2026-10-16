import { useEffect, useRef, useState } from 'react'
import { chatWithCompanion, type CompanionReply } from '../services/companion'

export type ChatEntry = { id: number; role: 'user'; content: string } | { id: number; role: 'assistant'; reply: CompanionReply }

export function useCompanionChat() {
  const [messages, setMessages] = useState<ChatEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(true)
  const request = useRef<AbortController | null>(null)
  const nextId = useRef(1)
  useEffect(() => { active.current = true; return () => { active.current = false; request.current?.abort() } }, [])

  async function send(message: string): Promise<boolean> {
    if (request.current || !message.trim()) return false
    const controller = new AbortController()
    request.current = controller
    setLoading(true); setError('')
    const userId = nextId.current++
    setMessages(old => [...old, { id: userId, role: 'user', content: message.trim() }])
    const timeout = window.setTimeout(() => controller.abort(), 35000)
    try {
      const reply = await chatWithCompanion(message.trim(), controller.signal)
      const replyId = nextId.current++
      if (active.current) setMessages(old => [...old, { id: replyId, role: 'assistant', reply }])
      return true
    } catch (reason) {
      if (active.current) setError(controller.signal.aborted ? '响应超时，请稍后重试。' : reason instanceof Error ? reason.message : '连接失败，请检查后端。')
      return false
    } finally {
      window.clearTimeout(timeout); request.current = null
      if (active.current) setLoading(false)
    }
  }
  return { messages, loading, error, send }
}
