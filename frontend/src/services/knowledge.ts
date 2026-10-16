import { obsidianApiUrl } from './api'

export interface SourceFile {
  id: number; file_name: string; file_path: string; content_hash: string; summary: string;
  tags: string[]; status: string; created_at: string; updated_at: string; indexed_at: string;
}
export interface VaultFiles {
  vault_path: string; connected: boolean; file_count: number; deleted_count: number;
  last_sync_at: string | null; last_sync_status: string | null; items: SourceFile[];
  total: number; offset: number; limit: number;
}
export interface SyncResult {
  status: string; scanned: number; added: number; updated: number; restored: number;
  deleted: number; unchanged: number; errors: { file_path: string; reason: string }[];
}
async function request<T>(path: string, method: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${obsidianApiUrl}${path}`, { method, signal })
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(typeof error?.detail === 'string' ? error.detail : `知识库请求失败（HTTP ${response.status}）`)
  }
  return response.json() as Promise<T>
}
export const knowledgeApi = {
  files: (offset: number, includeDeleted: boolean, signal?: AbortSignal) => request<VaultFiles>(`/files?offset=${offset}&limit=50&include_deleted=${includeDeleted}`, 'GET', signal),
  sync: () => request<SyncResult>('/sync', 'POST'),
}
