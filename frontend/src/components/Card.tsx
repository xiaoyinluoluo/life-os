import type { ReactNode } from 'react'

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return <section className="life-panel rounded-2xl border border-slate-200 bg-white p-6"><h2 className="mb-3 text-lg font-semibold">{title}</h2>{children}</section>
}
