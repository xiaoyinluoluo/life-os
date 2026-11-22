import { supabase } from './client';
import { countRecords, createRecord, listRecords, updateRecord, type CloudRecord, type RecordKind } from './records';

const kinds:RecordKind[]=['profile','goal','project','task','review','note','message','decision','setting'];
const arrays:RecordKind[]=['goal','project','task','review','note','message','decision'];
const now=()=>new Date().toISOString();
const uuid=()=>crypto.randomUUID();
const empty=()=>({profile:{name:'我的 Life OS',stage:'探索与成长',goal:'',status:''},goals:[],projects:[],tasks:[],reviews:[],notes:[],messages:[],decisions:[],settings:[]});
const plural=(kind:RecordKind)=>kind==='message'?'messages':kind==='review'?'reviews':kind==='goal'?'goals':kind==='project'?'projects':kind==='task'?'tasks':kind==='note'?'notes':kind==='decision'?'decisions':'settings';
let cache=new Map<string,CloudRecord>();
const pageLimits=new Map<RecordKind,number>();
const exhaustedKinds=new Map<RecordKind,boolean>();
export function canLoadMore(kind:RecordKind,count:number){return count>0&&count%50===0&&!exhaustedKinds.get(kind)}
export async function loadMoreRecords(kind:RecordKind){pageLimits.set(kind,(pageLimits.get(kind)||1)+1);return reload()}
function key(kind:RecordKind,id:string){return `${kind}:${id}`}
async function reload(){
 const all:CloudRecord[]=[];
 for(const kind of kinds){for(let page=0;page<(pageLimits.get(kind)||1);page++) {const rows=await listRecords(kind,page);all.push(...rows);exhaustedKinds.set(kind,rows.length<50);if(rows.length<50)break}}
 cache=new Map(all.map(r=>[key(r.kind,r.id),r]));
 const state:any=empty();
 for(const row of all){if(row.kind==='profile'&&row.id==='main')state.profile=row.data;else if(arrays.includes(row.kind))state[plural(row.kind)].push(row.data);else if(row.kind==='setting')state.settings.push(row.data)}
 state.totals=Object.fromEntries(await Promise.all(arrays.map(async kind=>[plural(kind),await countRecords(kind)])));
 return {state,version:all.map(r=>`${r.kind}/${r.id}/${r.version}`).sort().join('|'),updatedAt:all.reduce((max,r)=>r.updated_at>max?r.updated_at:max,'')};
}
async function insert(kind:RecordKind,data:Record<string,unknown>,id=String(data.id||uuid())){const row=await createRecord(kind,id,{...data,id});cache.set(key(kind,id),row);return row}
async function replace(kind:RecordKind,id:string,data:Record<string,unknown>,remove=false){const old=cache.get(key(kind,id));if(!old)throw new Error('记录已变化，请刷新后重试。');const row=await updateRecord(old,data,remove);cache.set(key(kind,id),row);return row}
function plan(message:string,goalId:string,state:any){if(!state.goals.some((g:any)=>g.id===goalId))throw new Error('请先选择自己的目标。');const createdAt=now();return {id:uuid(),goalId,title:message.slice(0,70),description:message,createdAt,expiresAt:new Date(Date.now()+1800000).toISOString(),status:'pending',tasks:['明确目标和验收标准','查找并整理必要资料','完成一个最小可展示成果','验证结果并收集反馈','记录复盘和下一步'],token:uuid()}}
export async function cloudFetch(command?:any,version?:string):Promise<Response>{
 try{
  const {data:{user}}=await supabase.auth.getUser();if(!user)return Response.json({error:'请先登录。'},{status:401});
  if(!command)return Response.json(await reload());
  let result:any=null;const current=await reload();
  if(version!==undefined&&version!==current.version)return Response.json({error:'数据已在另一台设备更新，请刷新后重试。'},{status:409});
  const state=current.state;
  switch(command.action){
   case 'profile': await (cache.has('profile:main')?replace('profile','main',command.profile):insert('profile',command.profile,'main'));break;
   case 'goal': await insert('goal',{id:uuid(),title:command.title,createdAt:now()});break;
   case 'task': {const t=state.tasks.find((x:any)=>x.id===command.id);if(!t)throw new Error('任务不存在。');await replace('task',t.id,{...t,status:command.done?'done':'todo',completedAt:command.done?now():null});break}
   case 'task-create': {if(!state.projects.some((x:any)=>x.id===command.projectId))throw new Error('请选择有效项目。');if(!String(command.title||'').trim())throw new Error('请输入任务。');await insert('task',{id:uuid(),projectId:command.projectId,title:String(command.title).trim(),status:'todo',dueDate:command.dueDate||'',priority:'medium',completedAt:null});break}
   case 'task-delete': {const t=state.tasks.find((x:any)=>x.id===command.id);if(!t)throw new Error('任务不存在。');await replace('task',t.id,t,true);break}
   case 'task-rename': {const t=state.tasks.find((x:any)=>x.id===command.id);if(!t)throw new Error('任务不存在。');if(!String(command.title||'').trim())throw new Error('请输入任务。');await replace('task',t.id,{...t,title:String(command.title).trim()});break}
   case 'review': await insert('review',{id:uuid(),content:command.content,createdAt:now()});break;
   case 'weekly-review': await insert('review',{id:uuid(),period:'weekly',content:command.content,createdAt:now()});break;
   case 'note': {const old=state.notes.find((x:any)=>x.name===command.name);if(old)await replace('note',old.id,{...old,content:command.content,updatedAt:now()});else await insert('note',{id:uuid(),name:command.name,content:command.content,updatedAt:now()});break}
   case 'chat': {
    const {data:reply,error}=await supabase.functions.invoke('life-companion',{body:{message:command.message}});
    if(error||!reply?.analysis)throw new Error('DeepSeek 暂未响应。请检查账号授权、云端密钥和网络。');
    await insert('message',{id:uuid(),message:command.message,reply,model:'DeepSeek',createdAt:now()});
    break;
   }
   case 'preview':result=plan(command.message,command.goalId,state);sessionStorage.setItem('life-plan',JSON.stringify(result));break;
   case 'cancel': sessionStorage.removeItem('life-plan');break;
   case 'confirm': {const pending=JSON.parse(sessionStorage.getItem('life-plan')||'null');if(!pending||pending.id!==command.id||pending.token!==command.token||Date.parse(pending.expiresAt)<Date.now())throw new Error('方案已过期，请重新预览。');const projectId=uuid();await insert('project',{id:projectId,goalId:pending.goalId,title:pending.title,description:pending.description,createdAt:now()});for(const title of pending.tasks)await insert('task',{id:uuid(),projectId,title,status:'todo',dueDate:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date()),priority:'medium',completedAt:null});sessionStorage.removeItem('life-plan');result={projectId};break}
   default: throw new Error('暂不支持此操作。');
  }
  return Response.json({...await reload(),result});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'云端操作失败。'},{status:e instanceof Error&&/变化|更新|冲突/.test(e.message)?409:400})}
}

