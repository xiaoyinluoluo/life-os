import {useEffect,useRef,useState} from 'react';
import {createRecord,getRecord,updateRecord} from './records';

type Folder={name:string;values():AsyncIterable<FileSystemFileHandle|Folder>};
async function* markdown(folder:Folder,prefix=''):AsyncGenerator<[string,File]>{
 for await(const item of folder.values()){
  if(item.name.startsWith('.'))continue;
  const path=prefix+item.name;
  if('getFile' in item){if(path.endsWith('.md'))yield [path,await item.getFile()];}
  else yield* markdown(item,path+'/');
 }
}
async function digest(text:string){
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
}
export default function ReadingSync(){
 const folder=useRef<Folder|null>(null),running=useRef(false);
 const [status,setStatus]=useState('');
 async function sync(){
  if(!folder.current||running.current)return;
  running.current=true;
  let changed=0,conflicts=0;
  try{
   for await(const [path,file] of markdown(folder.current)){
    const content=await file.text(),hash=await digest(content),id='weread-'+await digest(path);
    const old=await getRecord('note',id);
    if(old?.deleted_at)continue;
    if(old&&await digest(String(old.data.content))!==old.data.sourceHash){conflicts++;continue;}
    if(old?.data.sourceHash===hash)continue;
    const data={id,name:path,content,sourceHash:hash,updatedAt:new Date(file.lastModified).toISOString()};
    if(old)await updateRecord(old,data);else await createRecord('note',id,data);
    changed++;
   }
   setStatus(new Date().toLocaleTimeString()+' 已同步 '+changed+' 篇，冲突 '+conflicts+' 篇');
  }catch(e){setStatus(e instanceof Error?e.message:'同步失败，下次将重试');}
  finally{running.current=false;}
 }
 useEffect(()=>{const timer=setInterval(()=>void sync(),60000);return()=>{clearInterval(timer);folder.current=null;};},[]);
 async function select(){
  try{const dir=await (window as unknown as {showDirectoryPicker():Promise<Folder>}).showDirectoryPicker();
   if(dir.name!=='微信读书同步')throw new Error('请选择微信读书同步文件夹');
   folder.current=dir;await sync();
  }catch(e){setStatus(e instanceof Error?e.message:'无法选择目录');}
 }
 return <section className="panel"><h2>微信读书同步</h2><p>电脑打开此页期间每分钟检查一次 Markdown 笔记。源文件删除后保留云端副本。</p><button className="secondary" onClick={()=>void select()}>选择微信读书同步文件夹</button><p role="status">{status}</p></section>;
}
