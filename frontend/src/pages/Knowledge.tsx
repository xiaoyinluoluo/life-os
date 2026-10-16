import { useEffect, useState } from 'react'
import { Card } from '../components/Card'
import { PageHeading } from '../components/PageHeading'
import { knowledgeApi, type VaultFiles, type SyncResult } from '../services/knowledge'

const date = (value: string | null) => value ? new Date(value).toLocaleString('zh-CN') : '尚未同步'
export default function Knowledge() {
  const [vault, setVault] = useState<VaultFiles | null>(null)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [offset, setOffset] = useState(0)
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    knowledgeApi.files(offset, includeDeleted, controller.signal).then(value => { if (!controller.signal.aborted) setVault(value) }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '无法连接知识库服务')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [offset, includeDeleted, refresh])
  async function sync() {
    setSyncing(true); setError(''); setResult(null)
    try { setResult(await knowledgeApi.sync()); setOffset(0); setRefresh(value => value + 1) }
    catch (reason) { setError(reason instanceof Error ? reason.message : '同步失败，请重试') }
    finally { setSyncing(false) }
  }
  return <><PageHeading title="知识库" description="连接你的 Obsidian 笔记，让生命伙伴理解更多个人背景。" />
    <p className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">只读索引 · 不修改 Markdown · 数据保存在本机。同步由你手动触发。</p>
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <div className="space-y-6"><Card title="Vault 连接"><p className="break-all text-sm text-slate-600">{vault?.vault_path ?? '正在读取配置…'}</p><p className="mt-2 text-sm">{vault ? (vault.connected ? '目录已连接' : '目录不可用，请检查后端 .env 配置') : '等待后端响应'}</p>
      <div className="my-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">有效文件</p><p className="mt-1 text-xl">{vault?.file_count ?? '—'}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">保留的删除记录</p><p className="mt-1 text-xl">{vault?.deleted_count ?? '—'}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">最近同步</p><p className="mt-1 text-sm">{date(vault?.last_sync_at ?? null)}{vault?.last_sync_status === 'partial' && '（部分成功）'}</p></div></div>
      <div className="flex flex-wrap gap-3"><button disabled={syncing || loading || !vault?.connected} onClick={() => void sync()}>{syncing ? '正在读取并同步…' : '同步知识库'}</button><button disabled={syncing || loading} onClick={() => setRefresh(value => value + 1)}>刷新列表</button></div>
      {result && <div role="status" className="mt-4 text-sm leading-7"><p>新增 {result.added} · 更新 {result.updated} · 恢复 {result.restored} · 标记删除 {result.deleted} · 未变化 {result.unchanged}</p>{result.errors.length > 0 && <div className="mt-2 text-amber-800"><p>部分文件读取失败，本次未标记任何删除。</p>{result.errors.map((item, i) => <p className="break-all" key={i}>{item.file_path}：{item.reason}</p>)}</div>}</div>}
    </Card><Card title="已索引文件"><label className="mb-4 flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" disabled={syncing} checked={includeDeleted} onChange={event => { setIncludeDeleted(event.target.checked); setOffset(0) }} />显示已删除的索引记录</label>
      {loading ? <p role="status" className="text-sm text-slate-500">正在加载…</p> : vault?.items.length === 0 ? <p className="text-sm text-slate-500">暂无索引。将笔记放入配置的 Vault 后，点击同步知识库。</p> : <div className="space-y-4">{vault?.items.map(file => <article key={file.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center gap-2"><h3 className="break-all font-medium">{file.file_name}</h3>{file.status === 'deleted' && <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-500">源文件已删除 · 历史保留</span>}</div><p className="mt-1 break-all text-xs text-slate-500">{file.file_path}</p><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{file.summary || '无文本摘要'}</p><div className="mt-3 flex flex-wrap gap-2">{file.tags.map(tag => <span key={tag} className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-800">#{tag}</span>)}</div><p className="mt-3 text-xs text-slate-500">创建 {date(file.created_at)} · 修改 {date(file.updated_at)}</p></article>)}</div>}
      {vault && vault.total > 50 && <div className="mt-5 flex items-center justify-between gap-3"><button disabled={loading || syncing || offset === 0} onClick={() => setOffset(value => Math.max(0, value - 50))}>上一页</button><span className="text-sm text-slate-500">{offset + 1}–{Math.min(offset + 50, vault.total)} / {vault.total}</span><button disabled={loading || syncing || offset + 50 >= vault.total} onClick={() => setOffset(value => value + 50)}>下一页</button></div>}
    </Card></div>
  </>
}
