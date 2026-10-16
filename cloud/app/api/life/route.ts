import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { initialState, publicState, reply, makePlan, applyConfirmedPlan } from '../../life-model.mjs';
import { z } from 'zod';
export const dynamic='force-dynamic';
const short=z.string().trim().min(1).max(200);
const commands=z.discriminatedUnion('action',[
 z.object({action:z.literal('profile'),profile:z.object({name:short,stage:short,goal:z.string().max(1000),status:z.string().max(2000)})}),
 z.object({action:z.literal('goal'),title:short}),
 z.object({action:z.literal('task'),id:z.string().uuid(),done:z.boolean()}),
 z.object({action:z.literal('review'),content:z.string().trim().min(1).max(6000)}),
 z.object({action:z.literal('note'),name:short,content:z.string().trim().min(1).max(60000)}),
 z.object({action:z.literal('chat'),message:z.string().trim().min(1).max(4000)}),
 z.object({action:z.literal('preview'),message:z.string().trim().min(1).max(4000),goalId:z.string().uuid()}),
 z.object({action:z.literal('confirm'),id:z.string().uuid(),token:z.string().min(20).max(128),confirmed:z.literal(true)}),
 z.object({action:z.literal('cancel'),id:z.string().uuid()}),
]);
function json(value:any,status=200){return Response.json(value,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}})}
async function hash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(v=>v.toString(16).padStart(2,'0')).join('')}
async function load(user:any){
 if(!env.DB) throw new Error('云端数据库尚未连接。');
 const now=new Date().toISOString();
 await env.DB.prepare('INSERT OR IGNORE INTO life_accounts (user_id,content,version,updated_at) VALUES (?,?,0,?)').bind(user.userId,JSON.stringify(initialState(user.fullName || '我的 Life OS')),now).run();
 const row:any=await env.DB.prepare('SELECT content,version,updated_at FROM life_accounts WHERE user_id=?').bind(user.userId).first();
 return {state:JSON.parse(row.content),version:row.version,updatedAt:row.updated_at};
}
export async function GET(){
 const user=await getChatGPTUser();if(!user)return json({error:'请先使用 ChatGPT 登录。'},401);
 try{const row=await load(user);return json({...row,state:publicState(row.state),user:{name:user.displayName}})}catch{return json({error:'云端读取暂时失败，请稍后刷新。'},503)}
}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return json({error:'请先使用 ChatGPT 登录。'},401);
 const db=env.DB;if(!db)return json({error:'云端数据库尚未连接。'},503);
 const origin=request.headers.get('origin');
 if(!origin || origin!==new URL(request.url).origin)return json({error:'请求来源不受支持。'},403);
 if(Number(request.headers.get('content-length')||0)>150000)return json({error:'单次提交过大。'},413);
 try{
  const raw=await request.text();if(raw.length>100000)return json({error:'单次提交过大。'},413);
  const body=JSON.parse(raw);const parsed=commands.safeParse(body.command);
  if(!parsed.success||!Number.isSafeInteger(body.version)||body.version<0)return json({error:'输入格式不正确，请检查后重试。'},400);
  const command=parsed.data;const row=await load(user);
  if(row.version!==body.version)return json({error:'另一台设备已更新数据，已为你刷新；请核对后重试。'},409);
  const s=row.state;const now=new Date().toISOString();let result:any=null;
  if(command.action==='profile')s.profile=command.profile;
  if(command.action==='goal'){
   if(s.goals.length>=100)return json({error:'目标数量已达 100 个，请先整理已有目标。'},400);
   s.goals.push({id:crypto.randomUUID(),title:command.title,createdAt:now});
  }
  if(command.action==='task'){
   const task=s.tasks.find((t:any)=>t.id===command.id);if(!task)return json({error:'任务不存在。'},404);
   task.status=command.done?'done':'todo';task.completedAt=command.done?now:null;
  }
  if(command.action==='review')s.reviews.unshift({id:crypto.randomUUID(),content:command.content,createdAt:now});
  if(command.action==='note'){
   const old=s.notes.find((n:any)=>n.name===command.name);
   if(old){old.content=command.content;old.updatedAt=now}else s.notes.push({id:crypto.randomUUID(),name:command.name,content:command.content,updatedAt:now});
  }
  if(command.action==='chat'){
   const answer=reply(command.message,s);s.messages.push({id:crypto.randomUUID(),message:command.message,reply:answer,createdAt:now});s.messages=s.messages.slice(-80);
  }
  if(command.action==='preview'){
   s.proposals=s.proposals.filter((p:any)=>p.status==='pending'&&Date.parse(p.expiresAt)>Date.now()).slice(-9);
   const plan=makePlan(command.message,command.goalId,s,crypto.randomUUID(),now);
   const token=crypto.randomUUID()+crypto.randomUUID();
   s.proposals.push({...plan,tokenHash:await hash(token)});result={...plan,token};
  }
  if(command.action==='confirm'||command.action==='cancel'){
   const plan=s.proposals.find((p:any)=>p.id===command.id);if(!plan)return json({error:'方案不存在或已过期。'},404);
   if(command.action==='cancel'){if(plan.status!=='pending')return json({error:'该方案不能取消。'},409);plan.status='cancelled'}
   else{
    if(plan.tokenHash!==await hash(command.token))return json({error:'确认凭据不匹配，请重新生成方案。'},403);
    result=applyConfirmedPlan(s,plan,()=>crypto.randomUUID(),now);
   }
  }
  const encoded=JSON.stringify(s);if(new TextEncoder().encode(encoded).length>800000)return json({error:'个人空间已接近容量上限，请先导出备份并整理笔记。'},413);
  const update=await db.prepare('UPDATE life_accounts SET content=?,version=version+1,updated_at=? WHERE user_id=? AND version=?').bind(encoded,now,user.userId,row.version).run();
  if(update.meta.changes!==1)return json({error:'另一台设备刚刚更新了数据，请刷新后重试。'},409);
  return json({state:publicState(s),version:row.version+1,updatedAt:now,result});
 }catch(error){
  if(error instanceof SyntaxError)return json({error:'提交格式无效。'},400);
  if(error instanceof Error&&/目标|过期|取消/.test(error.message))return json({error:error.message},400);
  return json({error:'保存暂时失败，内容没有确认保存，请重试。'},503);
 }
}
