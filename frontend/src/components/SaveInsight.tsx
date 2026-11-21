import { useState } from 'react'
import { workbenchRequest } from '../services/workbench'
export function SaveInsight({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState(text.slice(0, 8000))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  return <div className="mt-3"><button type="button" className="!bg-slate-100 !text-slate-700" onClick={() => setOpen(!open)}>保存值得保留的结论</button>
    {open && <form className="mt-3 space-y-3 rounded-lg border bg-white p-4" onSubmit={async e => { e.preventDefault(); setBusy(true); try { await workbenchRequest('/insights', { title, body }); setMessage('已保存在每周回顾页的长期参考中。'); setOpen(false) } catch { setMessage('保存失败，请重试。') } finally { setBusy(false) } }}>
      <p className="text-sm">请核实并编辑后保存。AI 的推测需要标明，不能直接当成个人事实。</p>
      <label className="block">结论标题<input required maxLength={200} className="mt-1 w-full rounded border p-2" value={title} onChange={e => setTitle(e.target.value)} /></label>
      <label className="block">准备长期保留的内容<textarea required maxLength={8000} className="mt-1 min-h-40 w-full rounded border p-2" value={body} onChange={e => setBody(e.target.value)} /></label>
      <button disabled={busy || !title.trim() || !body.trim()}>确认保存</button>
    </form>}{message && <p role="status" className="mt-2 text-sm">{message}</p>}
  </div>
}
