import { useEffect, useRef, useState } from 'react'

const key = 'lifeos-appearance-v1'
function wallpaperStore(mode: IDBTransactionMode, file?: Blob, item = 'wallpaper'): Promise<Blob | undefined> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('lifeos-wallpaper', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('images')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction('images', mode)
      const store = tx.objectStore('images')
      let result: Blob | undefined
      if (mode === 'readwrite' && file) store.put(file, item)
      else { const get = store.get(item); get.onsuccess = () => { result = get.result } }
      tx.oncomplete = () => { db.close(); resolve(result) }
      tx.onerror = () => { db.close(); reject(tx.error) }
      tx.onabort = () => { db.close(); reject(tx.error) }
    }
  })
}
let wallpaperUrl = ''
export async function restoreWallpaper() {
  const prefs = readPreferences()
  if (prefs.wallpaper !== 'image') return
  try { const file = await wallpaperStore('readonly'); if (file) { if (wallpaperUrl) URL.revokeObjectURL(wallpaperUrl); wallpaperUrl = URL.createObjectURL(file); applyPreferences({ ...prefs, image: wallpaperUrl }) } else if (prefs.image) applyPreferences(prefs) } catch { if (prefs.image) applyPreferences(prefs) }
}

type Preferences = { size: string; wallpaper: string; image: string; motion: boolean; volume: number; font: string; blur: number }
const defaults: Preferences = { size: '100', wallpaper: 'default', image: '', motion: false, volume: 30, font: 'handwritten', blur: 0 }
export function readPreferences(): Preferences {
  try { const saved = JSON.parse(localStorage.getItem(key) || '{}'); if (!localStorage.getItem('lifeos-handwriting-updated')) { saved.font = 'handwritten'; localStorage.setItem('lifeos-handwriting-updated', '1') } return { ...defaults, ...saved } } catch { return defaults }
}
let imageRevision = 0
let customFont: FontFace | null = null
export async function restoreFont() {
  if (readPreferences().font !== 'custom') return
  try {
    const file = await wallpaperStore('readonly', undefined, 'font')
    if (!file || readPreferences().font !== 'custom') return
    const font = new FontFace('LifeOSCustom', await file.arrayBuffer())
    await font.load()
    if (readPreferences().font !== 'custom') return
    if (customFont) document.fonts.delete(customFont)
    customFont = font; document.fonts.add(font)
    document.body.style.fontFamily = 'LifeOSCustom, Microsoft YaHei, sans-serif'
  } catch { document.body.style.fontFamily = 'Microsoft YaHei, sans-serif' }
}
export function applyPreferences(p: Preferences) {
  const revision = ++imageRevision
  document.documentElement.classList.remove('wallpaper-dark')
  if (p.wallpaper === 'image' && p.image) {
    const image = new Image()
    image.onload = () => {
      if (revision !== imageRevision) return
      const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32
      const ctx = canvas.getContext('2d'); if (!ctx) return
      ctx.drawImage(image, 0, 0, 32, 32)
      const pixels = ctx.getImageData(0, 0, 32, 32).data
      let total = 0
      for (let i = 0; i < pixels.length; i += 4) total += .2126 * pixels[i] + .7152 * pixels[i + 1] + .0722 * pixels[i + 2]
      document.documentElement.classList.toggle('wallpaper-dark', total / 1024 < 115)
    }
    image.src = p.image
  }
  document.body.style.fontFamily = p.font === 'serif' ? 'SimSun, Songti SC, serif' : p.font === 'custom' ? 'LifeOSCustom, Microsoft YaHei, sans-serif' : p.font === 'default' ? 'Inter, Microsoft YaHei, sans-serif' : 'KaiTi, STKaiti, Comic Sans MS, cursive'
  if (p.font === 'custom') void restoreFont()
  document.documentElement.style.fontSize = `${p.size}%`
  let backdrop = document.getElementById('life-wallpaper')
  if (!backdrop) { backdrop = document.createElement('div'); backdrop.id = 'life-wallpaper'; backdrop.setAttribute('aria-hidden', 'true'); document.body.prepend(backdrop) }
  backdrop.style.background = p.wallpaper === 'image' && p.image ? `linear-gradient(#00000033,#00000033), url(${JSON.stringify(p.image)}) center / cover no-repeat` : p.wallpaper === 'green' ? '#e5f4ec' : p.wallpaper === 'blue' ? '#e5eff9' : '#f8fafc'
  backdrop.style.filter = `blur(${Math.max(0, Math.min(24, Number(p.blur) || 0))}px)`
  document.documentElement.classList.toggle('reduce-motion', p.motion)
}
export default function Settings() {
  const [prefs, setPrefs] = useState(readPreferences)
  const [music, setMusic] = useState('')
  const [error, setError] = useState('')
  const audio = useRef<HTMLAudioElement>(null)
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify({ ...prefs, image: prefs.image.startsWith('blob:') ? '' : prefs.image })); applyPreferences(prefs); if (prefs.wallpaper === 'image' && !prefs.image) void restoreWallpaper() } catch { setError('设置保存失败，请检查浏览器存储空间。') } }, [prefs])
  useEffect(() => { if (prefs.wallpaper === 'image' && !prefs.image) void wallpaperStore('readonly').then(file => { if (file) { if (wallpaperUrl) URL.revokeObjectURL(wallpaperUrl); wallpaperUrl = URL.createObjectURL(file); setPrefs(p => p.wallpaper === 'image' ? { ...p, image: wallpaperUrl } : p) } }).catch(() => setError('壁纸读取失败。')) }, [])
  useEffect(() => { if (audio.current) audio.current.volume = prefs.volume / 100 }, [prefs.volume, music])
  const update = (v: Partial<Preferences>) => setPrefs(p => ({ ...p, ...v }))
  return <div className="space-y-5"><h1 className="text-3xl font-semibold">设置</h1>
    <section className="life-panel space-y-4 rounded-2xl border bg-white p-5"><h2 className="text-xl font-semibold">外观</h2>
      <label className="block">字体大小 <select value={prefs.size} onChange={e => update({ size: e.target.value })} className="rounded border p-2"><option value="90">小</option><option value="100">标准</option><option value="115">大</option></select></label>
      <label className="block">字体 <select value={prefs.font} onChange={e => update({ font: e.target.value })} className="rounded border p-2"><option value="handwritten">手写风格</option><option value="default">系统默认</option><option value="serif">宋体</option><option value="custom">自定义字体</option></select></label>
      <label className="block">上传字体（TTF、OTF 或 WOFF，最大 10 MB）<input type="file" accept=".ttf,.otf,.woff,.woff2" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; if (file.size > 10 * 1024 * 1024) { setError('字体文件不能超过 10 MB。'); return } void (async () => { try { const font = new FontFace('LifeOSCustom', await file.arrayBuffer()); await font.load(); await wallpaperStore('readwrite', file, 'font'); if (customFont) document.fonts.delete(customFont); customFont = font; document.fonts.add(font); setError(''); update({ font: 'custom' }) } catch { setError('字体无法读取或保存，请检查文件格式和存储空间。') } })() }} /></label>
      <p className="text-sm text-slate-600">壁纸外的文字会根据图片明暗自动调整；白色内容卡片保留深色文字。</p>
      <label className="block">背景 <select value={prefs.wallpaper} onChange={e => update({ wallpaper: e.target.value })} className="rounded border p-2"><option value="default">默认</option><option value="green">浅绿</option><option value="blue">浅蓝</option>{prefs.image && <option value="image">自选图片</option>}</select></label>
      <label className="block">上传壁纸（最大 5 MB）<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 5 * 1024 * 1024) { setError('请选择不超过 5 MB 的图片。'); e.target.value = ''; return } void wallpaperStore('readwrite', f).then(() => { if (wallpaperUrl) URL.revokeObjectURL(wallpaperUrl); wallpaperUrl = URL.createObjectURL(f); setError(''); update({ image: wallpaperUrl, wallpaper: 'image' }) }).catch(() => setError('壁纸保存失败，请检查浏览器存储空间。')); e.target.value = '' }} /></label>
      <label className="block">壁纸磨砂程度 <input type="range" min="0" max="24" value={prefs.blur} onChange={e => update({ blur: Number(e.target.value) })} /> {prefs.blur} / 24</label>
      <label className="block"><input type="checkbox" checked={prefs.motion} onChange={e => update({ motion: e.target.checked })} /> 减少动效</label>
      <button onClick={() => setPrefs(defaults)}>恢复外观默认设置</button>{error && <p role="alert" className="text-red-700">{error}</p>}
    </section>
    <section className="life-panel space-y-4 rounded-2xl border bg-white p-5"><h2 className="text-xl font-semibold">背景音乐</h2><p>选择本机音频后，可播放、暂停和调节音量。页面关闭后需重新选择文件。</p><input type="file" accept="audio/*" onChange={e => { const file = e.target.files?.[0]; if (music) URL.revokeObjectURL(music); setMusic(file ? URL.createObjectURL(file) : '') }} />{music && <audio ref={audio} controls loop src={music} />}<label className="block">音量 <input type="range" min="0" max="100" value={prefs.volume} onChange={e => update({ volume: Number(e.target.value) })} /> {prefs.volume}%</label></section>
    <section className="life-panel space-y-3 rounded-2xl border bg-white p-5"><h2 className="text-xl font-semibold">提醒与每日资讯</h2><p>每日 AI 资讯已在 Codex 设置为北京时间早上 7 点。到期验证会显示在首页和每周回顾。</p><p>手机推送和网站内定时任务尚未接通；电脑关闭时本机任务无法运行。</p></section>
  </div>
}
