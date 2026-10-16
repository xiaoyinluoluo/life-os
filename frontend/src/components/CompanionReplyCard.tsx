import type { CompanionReply } from '../services/companion'

export function CompanionReplyCard({ reply }: { reply: CompanionReply }) {
  return <article className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
    <p className="mb-3 text-xs font-semibold text-emerald-800">Life Companion · 模拟回复</p>
    <h3 className="mb-2 font-medium">理解与分析</h3><p className="whitespace-pre-wrap break-words text-sm leading-7">{reply.analysis}</p>
    <h3 className="mb-2 mt-4 font-medium">建议</h3><ul className="list-inside list-disc space-y-2 text-sm leading-6">{reply.suggestions.map((item, i) => <li className="break-words" key={i}>{item}</li>)}</ul>
    <h3 className="mb-2 mt-4 font-medium">下一步行动</h3><ol className="list-inside list-decimal space-y-2 text-sm leading-6">{reply.next_actions.map((item, i) => <li className="break-words" key={i}>{item}</li>)}</ol>
  </article>
}
