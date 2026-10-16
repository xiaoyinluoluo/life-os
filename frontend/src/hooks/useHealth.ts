import { useEffect, useState } from 'react'
import { getHealth, type Health } from '../services/api'

export function useHealth() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 10000)
    let active = true
    setLoading(true); setError(''); setHealth(null)
    getHealth(controller.signal)
      .then(result => { if (active) setHealth(result) })
      .catch(reason => { if (active) setError(controller.signal.aborted ? '连接超时，请检查后端服务后重试。' : reason instanceof Error ? reason.message : '无法连接后端。') })
      .finally(() => { window.clearTimeout(timeout); if (active) setLoading(false) })
    return () => { active = false; window.clearTimeout(timeout); controller.abort() }
  }, [attempt])
  return { health, error, loading, refresh: () => setAttempt(value => value + 1) }
}
