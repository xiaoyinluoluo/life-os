import { useEffect, useState } from 'react';
import { supabase } from './client';
import { createRecord, getRecord, updateRecord } from './records';

type Appearance={wallpaper?:string;font?:string;fontSize?:number;blur?:number};
const bucket='life-private';
let wallpaperUrl='';
let fontUrl='';
export async function applyAppearance(p:Appearance){
 const root=document.documentElement;
 root.style.fontSize=`${Math.max(80,Math.min(130,p.fontSize||100))}%`;
 root.style.setProperty('--wallpaper-blur',`${Math.max(0,Math.min(24,p.blur||0))}px`);
 if(p.wallpaper){const {data,error}=await supabase.storage.from(bucket).createSignedUrl(p.wallpaper,3600);if(error)throw error;wallpaperUrl=data.signedUrl;root.style.setProperty('--life-wallpaper',`url("${wallpaperUrl}")`)}else root.style.removeProperty('--life-wallpaper');
 if(p.font){const {data,error}=await supabase.storage.from(bucket).createSignedUrl(p.font,3600);if(error)throw error;fontUrl=data.signedUrl;const font=new FontFace('LifeOSCloud',`url("${fontUrl}")`);await font.load();(document.fonts as FontFaceSet & {add(font:FontFace):void}).add(font);root.style.setProperty('--life-font','LifeOSCloud, sans-serif')}else root.style.removeProperty('--life-font');
}
export async function loadAppearance(){const row=await getRecord('setting','appearance');if(row)await applyAppearance(row.data as Appearance)}
async function save(p:Appearance){const row=await getRecord('setting','appearance');if(row)await updateRecord(row,p);else await createRecord('setting','appearance',p);await applyAppearance(p)}
async function upload(file:File,type:'wallpaper'|'font'){
 if(file.size>5*1024*1024)throw new Error('文件不能超过 5 MB。');
 if(type==='wallpaper'&&!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('壁纸只支持 PNG、JPEG 或 WebP。');
 if(type==='font'&&!/\.(ttf|otf|woff2?)$/i.test(file.name))throw new Error('字体只支持 TTF、OTF、WOFF。');
 const {data:{user},error:authError}=await supabase.auth.getUser();if(authError||!user)throw new Error('请先登录。');
 const path=`${user.id}/${type}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
 const {error}=await supabase.storage.from(bucket).upload(path,file,{upsert:false,contentType:file.type||'application/octet-stream'});if(error)throw error;
 return path;
}
export default function AppearanceSettings(){
 const [p,setP]=useState<Appearance>({fontSize:100,blur:0}),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{void getRecord('setting','appearance').then(r=>{if(r)setP(r.data as Appearance)}).catch(e=>setMessage(e.message))},[]);
 async function change(next:Appearance){setBusy(true);setMessage('正在同步…');try{await save(next);setP(next);setMessage('已保存并应用。')}catch(e){setMessage(e instanceof Error?e.message:'保存或应用失败，请检查云端连接后重试。')}finally{setBusy(false)}}
 async function pick(file:File,type:'wallpaper'|'font'){setBusy(true);setMessage('正在上传…');try{const path=await upload(file,type);await change({...p,[type]:path})}catch(e){setMessage(e instanceof Error?e.message:'上传失败。')}finally{setBusy(false)}}
 return <section className="panel"><div className="panel-title"><h2>外观设置</h2></div><div className="form"><label>字体大小：{p.fontSize||100}%<input type="range" min="80" max="130" value={p.fontSize||100} disabled={busy} onChange={e=>setP({...p,fontSize:Number(e.target.value)})} onPointerUp={()=>void change(p)}/></label><label>壁纸磨砂程度：{p.blur||0}<input type="range" min="0" max="24" value={p.blur||0} disabled={busy} onChange={e=>setP({...p,blur:Number(e.target.value)})} onPointerUp={()=>void change(p)}/></label><label>上传壁纸（PNG/JPEG/WebP，最大 5 MB）<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void pick(f,'wallpaper');e.target.value=''}}/></label><label>上传字体（TTF/OTF/WOFF，最大 5 MB）<input type="file" accept=".ttf,.otf,.woff,.woff2" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void pick(f,'font');e.target.value=''}}/></label><button className="secondary" disabled={busy} onClick={()=>void change({fontSize:p.fontSize,blur:p.blur})}>恢复默认壁纸和字体</button><p role="status">{message}</p></div></section>
}
