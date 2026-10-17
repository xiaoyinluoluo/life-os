import { z } from "npm:zod@3.25.76";
import { initialState, publicState, reply, makePlan, applyConfirmedPlan } from "./life-model.mjs";

const origin = "https://xiaoyinluoluo.github.io";
const cors = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
};
const short = z.string().trim().min(1).max(200);
const commands = z.discriminatedUnion("action", [
  z.object({ action:z.literal("profile"), profile:z.object({name:short,stage:short,goal:z.string().max(1000),status:z.string().max(2000)}) }),
  z.object({ action:z.literal("goal"), title:short }),
  z.object({ action:z.literal("task"), id:z.string().uuid(), done:z.boolean() }),
  z.object({ action:z.literal("review"), content:z.string().trim().min(1).max(6000) }),
  z.object({ action:z.literal("note"), name:short, content:z.string().trim().min(1).max(60000) }),
  z.object({ action:z.literal("chat"), message:z.string().trim().min(1).max(4000) }),
  z.object({ action:z.literal("preview"), message:z.string().trim().min(1).max(4000), goalId:z.string().uuid() }),
  z.object({ action:z.literal("confirm"), id:z.string().uuid(), token:z.string().min(20).max(128), confirmed:z.literal(true) }),
  z.object({ action:z.literal("cancel"), id:z.string().uuid() }),
]);
const json = (body:unknown,status=200) => Response.json(body,{status,headers:{...cors,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
async function hash(value:string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))).map(v=>v.toString(16).padStart(2,"0")).join("");
}
Deno.serve(async request => {
  if (request.method==="OPTIONS") return new Response(null,{status:204,headers:cors});
  if (!["GET","POST"].includes(request.method)) return json({error:"不支持此操作。"},405);
  if (request.headers.get("origin")!==origin) return json({error:"请求来源不受支持。"},403);
  const base = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  const bearer = request.headers.get("authorization");
  if (!base || !key) return json({error:"云端配置暂时不可用。"},503);
  if (!bearer?.startsWith("Bearer ")) return json({error:"请先登录。"},401);
  const auth = await fetch(base+"/auth/v1/user",{headers:{apikey:key,authorization:bearer}});
  if (!auth.ok) return json({error:"登录已过期，请重新登录。"},401);
  const user = await auth.json();
  if (!user?.id) return json({error:"请先登录。"},401);
  const headers = {apikey:key,authorization:bearer,"Content-Type":"application/json"};
  const url = base+"/rest/v1/life_accounts?user_id=eq."+encodeURIComponent(user.id);
  async function load() {
    let response = await fetch(url+"&select=content,version,updated_at",{headers});
    if (!response.ok) throw new Error("read");
    let rows = await response.json();
    if (!rows.length) {
      const initial = initialState(user.email?.split("@")[0] || "我的 Life OS");
      await fetch(base+"/rest/v1/life_accounts",{method:"POST",headers:{...headers,Prefer:"resolution=ignore-duplicates"},body:JSON.stringify({user_id:user.id,content:initial})});
      response = await fetch(url+"&select=content,version,updated_at",{headers});
      if (!response.ok) throw new Error("read");
      rows = await response.json();
    }
    if (!rows.length) throw new Error("read");
    return rows[0];
  }
  try {
    const row = await load();
    if (request.method==="GET") return json({state:publicState(row.content),version:row.version,updatedAt:row.updated_at,user:{name:user.email}});
    if (Number(request.headers.get("content-length")||0)>150000) return json({error:"单次提交过大。"},413);
    const raw = await request.text();
    if (raw.length>100000) return json({error:"单次提交过大。"},413);
    const body = JSON.parse(raw);
    const parsed = commands.safeParse(body.command);
    if (!parsed.success || !Number.isSafeInteger(body.version) || body.version<0) return json({error:"输入格式不正确，请检查后重试。"},400);
    if (row.version!==body.version) return json({error:"另一台设备已更新数据，请刷新后重试。"},409);
    const command = parsed.data;
    const s = row.content;
    const now = new Date().toISOString();
    let result:unknown=null;
    if (command.action==="profile") s.profile=command.profile;
    if (command.action==="goal") {
      if (s.goals.length>=100) return json({error:"目标数量已达 100 个。"},400);
      s.goals.push({id:crypto.randomUUID(),title:command.title,createdAt:now});
    }
    if (command.action==="task") {
      const task=s.tasks.find((t:{id:string})=>t.id===command.id);
      if (!task) return json({error:"任务不存在。"},404);
      task.status=command.done?"done":"todo";
      task.completedAt=command.done?now:null;
    }
    if (command.action==="review") s.reviews.unshift({id:crypto.randomUUID(),content:command.content,createdAt:now});
    if (command.action==="note") {
      const old=s.notes.find((n:{name:string})=>n.name===command.name);
      if (old) {old.content=command.content;old.updatedAt=now}
      else s.notes.push({id:crypto.randomUUID(),name:command.name,content:command.content,updatedAt:now});
    }
    if (command.action==="chat") {
      const answer=reply(command.message,s);
      s.messages.push({id:crypto.randomUUID(),message:command.message,reply:answer,createdAt:now});
      s.messages=s.messages.slice(-80);
    }
    if (command.action==="preview") {
      s.proposals=s.proposals.filter((p:{status:string;expiresAt:string})=>p.status==="pending"&&Date.parse(p.expiresAt)>Date.now()).slice(-9);
      const plan=makePlan(command.message,command.goalId,s,crypto.randomUUID(),now);
      const token=crypto.randomUUID()+crypto.randomUUID();
      s.proposals.push({...plan,tokenHash:await hash(token)});
      result={...plan,token};
    }
    if (command.action==="confirm"||command.action==="cancel") {
      const plan=s.proposals.find((p:{id:string})=>p.id===command.id);
      if (!plan) return json({error:"方案不存在或已过期。"},404);
      if (command.action==="cancel") {
        if (plan.status!=="pending") return json({error:"该方案不能取消。"},409);
        plan.status="cancelled";
      } else {
        if (plan.tokenHash!==await hash(command.token)) return json({error:"确认凭据不匹配，请重新生成方案。"},403);
        result=applyConfirmedPlan(s,plan,()=>crypto.randomUUID(),now);
      }
    }
    if (new TextEncoder().encode(JSON.stringify(s)).length>800000) return json({error:"个人空间已接近容量上限，请先导出备份并整理笔记。"},413);
    const patchUrl=url+"&version=eq."+row.version+"&select=version,updated_at";
    const update=await fetch(patchUrl,{method:"PATCH",headers:{...headers,Prefer:"return=representation"},body:JSON.stringify({content:s,version:row.version+1,updated_at:now})});
    if (!update.ok) throw new Error("save");
    const updated=await update.json();
    if (updated.length!==1) return json({error:"另一台设备刚刚更新了数据，请刷新后重试。"},409);
    return json({state:publicState(s),version:updated[0].version,updatedAt:updated[0].updated_at,result});
  } catch (error) {
    if (error instanceof SyntaxError) return json({error:"提交格式无效。"},400);
    if (error instanceof Error && /目标|过期|取消/.test(error.message)) return json({error:error.message},400);
    return json({error:"云端暂时不可用，请稍后重试。"},503);
  }
});
