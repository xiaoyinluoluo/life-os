import { useEffect, useRef, useState } from 'react'
import { toolApi, type ToolProposal, type ExecutionResult } from '../services/tools'

export function useToolAction() {
  const [goals, setGoals] = useState<{ id: number; title: string }[]>([])
  const [goalId, setGoalId] = useState('')
  const [proposal, setProposal] = useState<ToolProposal | null>(null)
  const [result, setResult] = useState<ExecutionResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState('')
  const [error, setError] = useState('')
  const running = useRef(false)
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    const controller = new AbortController()
    toolApi.goals(controller.signal).then(value => {
      if (active.current && !controller.signal.aborted) { setGoals(value.items); setGoalId(value.items[0] ? String(value.items[0].id) : '') }
    }).catch(reason => { if (!controller.signal.aborted && active.current) setError(reason instanceof Error ? reason.message : '无法读取目标') })
    return () => { active.current = false; controller.abort() }
  }, [])

  async function run(label: string, action: () => Promise<void>) {
    if (running.current) return
    running.current = true; setBusy(true); setError(''); setPhase(label)
    try { await action() }
    catch (reason) { if (active.current) setError(reason instanceof Error ? reason.message : '工具操作失败') }
    finally { running.current = false; if (active.current) { setBusy(false); setPhase('') } }
  }
  function preview(message: string) {
    if (!message.trim() || !goalId || (proposal?.status === 'pending' && !result)) return
    return run('正在读取档案、搜索知识并生成待确认方案…', async () => {
      const value = await toolApi.preview(message, Number(goalId))
      if (active.current) { setProposal(value); setResult(null) }
    })
  }
  function confirm() {
    if (!proposal?.confirmation_token || proposal.status !== 'pending') return
    return run('正在执行已确认方案，请勿重复点击…', async () => {
      try {
        const value = await toolApi.confirm(proposal.id, proposal.confirmation_token!)
        if (active.current) { setResult(value); setProposal(old => old ? { ...old, status: 'executed', result: value } : old) }
      } catch (reason) {
        // Reconcile a lost response or terminal failure with the server. Never
        // regenerate or retry a write automatically after a network error.
        const current = await toolApi.get(proposal.id).catch(() => null)
        if (current && active.current) {
          setProposal({ ...current, confirmation_token: proposal.confirmation_token })
          if (current.status === 'executed' && current.result) { setResult(current.result); return }
        }
        throw reason
      }
    })
  }
  function cancel() {
    if (!proposal?.confirmation_token) return
    return run('正在取消待确认方案…', async () => {
      try {
        const value = await toolApi.cancel(proposal.id, proposal.confirmation_token!)
        if (active.current) setProposal(value)
      } catch (reason) {
        const current = await toolApi.get(proposal.id).catch(() => null)
        if (current && active.current) {
          setProposal({ ...current, confirmation_token: proposal.confirmation_token })
          if (current.status === 'cancelled') return
          if (current.status === 'executed' && current.result) setResult(current.result)
        }
        throw reason
      }
    })
  }
  return { goals, goalId, setGoalId, proposal, result, busy, phase, error, preview, confirm, cancel }
}
