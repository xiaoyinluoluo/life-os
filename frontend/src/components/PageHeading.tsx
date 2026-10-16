export function PageHeading({ title, description }: { title: string; description: string }) {
  return <div className="mb-8"><p className="mb-2 text-xs font-medium uppercase tracking-widest text-emerald-700">Life OS</p><h1 className="text-3xl font-semibold">{title}</h1><p className="mt-3 text-sm leading-6 text-slate-500">{description}</p></div>
}
