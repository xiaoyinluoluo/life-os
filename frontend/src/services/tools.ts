import { companionChatUrl } from './api'

const base = companionChatUrl.replace(/\/chat$/, '')
export interface ToolOperation { tool_name: string; arguments: Record<string, string | number | null> }
export interface ToolStep { label: string; status: string }
export interface ExecutionResult {
  success: boolean; message: string; project_id: number | null; task_ids: number[];
  plan_url: string; already_executed: boolean; steps: ToolStep[];
  outputs: { tool_name: string; output: Record<string, unknown> }[];
}
export interface ToolProposal {
  id: string; status: string; analysis: string; summary: string; operations: ToolOperation[];
  confirmation_token?: string; expires_at: string; created_at: string; steps?: ToolStep[];
  result: ExecutionResult | null;
  project?: { id: number; title: string; description: string; goal_id: number } | null;
  tasks?: { id: number; title: string; description: string; priority: string; status: string; due_date: string | null }[];
}
async function request<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal })
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(typeof error?.detail === 'string' ? error.detail : `工具请求失败（HTTP ${response.status}），请检查输入或后端服务。`)
  }
  return response.json() as Promise<T>
}
export const toolApi = {
  goals: (signal?: AbortSignal) => request<{ items: { id: number; title: string }[] }>('/goals', 'GET', undefined, signal),
  preview: (message: string, goal_id: number) => request<ToolProposal>('/actions/preview', 'POST', { message, goal_id }),
  confirm: (id: string, confirmation_token: string) => request<ExecutionResult>(`/actions/${id}/confirm`, 'POST', { confirmation_token, confirmed: true }),
  cancel: (id: string, confirmation_token: string) => request<ToolProposal>(`/actions/${id}/cancel`, 'POST', { confirmation_token }),
  get: (id: string, signal?: AbortSignal) => request<ToolProposal>(`/actions/${id}`, 'GET', undefined, signal),
}
