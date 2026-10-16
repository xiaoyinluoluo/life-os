import { useEffect, useState } from 'react'
import { getDashboard, type DashboardData } from '../services/dashboard'

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshId, setRefreshId] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setLoading(true); setError('')
    const timeout = window.setTimeout(() => controller.abort(), 12000)
    getDashboard(controller.signal).then(value => { if (active) setData(value) }).catch(reason => {
      if (active) setError(controller.signal.aborted ? '驾驶舱请求超时，请稍后重试。' : reason instanceof Error ? reason.message : '驾驶舱暂时无法加载')
    }).finally(() => { window.clearTimeout(timeout); if (active) setLoading(false) })
    return () => { active = false; window.clearTimeout(timeout); controller.abort() }
  }, [refreshId])
  return { data, error, loading, refresh: () => setRefreshId(value => value + 1) }
}
