import { useEffect, useRef, useState } from 'react'
import { companionConversation, type ChatAttachment, type Conversation, type Provider } from '../services/companion'

export function useCompanionChat() {
  const [provider, setProvider] = useState<Provider>('openai')
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(true)
  const request = useRef<AbortController | null>(null)
  const retry = useRef<{ input: string; id: string } | null>(null)
  async function run(action: (signal: AbortSignal) => Promise<void>, initial = false) {
    if (request.current) return false
    const controller = new AbortController()
    request.current = controller
    setLoading(!initial)
    setError('')
    const timer = window.setTimeout(() => controller.abort(), 35000)
    try {
      await action(controller.signal)
      return true
    } catch (reason) {
      if (active.current && request.current === controller) {
        setError(controller.signal.aborted ? '响应超时，请稍后重试。' : reason instanceof Error ? reason.message : '连接失败，请检查后端。')
      }
      return false
    } finally {
      window.clearTimeout(timer)
      if (request.current === controller) {
        request.current = null
        if (active.current) { setLoading(false); setChecking(false) }
      }
    }
  }

  function load() {
    if (request.current) return
    setChecking(true)
    void run(async signal => {
      const state = await companionConversation('', signal, undefined, provider)
      if (active.current && !signal.aborted) setConversation(state)
    }, true)
  }

  useEffect(() => {
    active.current = true
    load()
    return () => {
      active.current = false
      request.current?.abort()
      request.current = null
    }
  }, [provider])

  async function send(message: string, attachment: ChatAttachment | null) {
    const text = message.trim()
    if (!conversation || !text) return false
    return run(async signal => {
      if (!conversation.configured) throw new Error('请先配置所选 AI 的 API Key。')
      const input = JSON.stringify([provider, text, attachment])
      if (retry.current?.input !== input) retry.current = { input, id: crypto.randomUUID() }
      const state = await companionConversation('', signal, { message: text, request_id: retry.current.id, attachment, provider })
      if (active.current && !signal.aborted) {
        setConversation(state)
        retry.current = null
      }
    })
  }

  async function clear() {
    if (!conversation) return false
    return run(async signal => {
      const state = await companionConversation('/clear', signal, { revision: conversation.revision, provider })
      if (active.current && !signal.aborted) {
        setConversation(state)
        retry.current = null
      }
    })
  }

  function changeProvider(value: Provider) {
    if (request.current) return
    setConversation(null)
    setChecking(true)
    retry.current = null
    setProvider(value)
  }

  return { provider, changeProvider, conversation, checking, loading, error, send, clear, load }
}
