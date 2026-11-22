const headers = {'Access-Control-Allow-Origin':'https://xiaoyinluoluo.github.io','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info'};
const respond = (body:object,status=200) => Response.json(body,{status,headers});
Deno.serve(async req=>{
 if(req.method==='OPTIONS') return new Response(null,{headers});
 if(req.method!=='POST') return respond({error:'需要 POST 请求'},405);
 const auth=await fetch(Deno.env.get('SUPABASE_URL')+'/auth/v1/user',{headers:{Authorization:req.headers.get('authorization')||'',apikey:Deno.env.get('SUPABASE_ANON_KEY')!}});
 if(!auth.ok)return respond({error:'请重新登录'},401);
 const user=await auth.json();
 if(user.id!==Deno.env.get('LIFE_AI_OWNER_ID'))return respond({error:'该账号尚未启用云端 AI'},403);
 const key=Deno.env.get('DEEPSEEK_API_KEY');
 if(!key)return respond({error:'云端尚未配置 DeepSeek 密钥'},503);
 const input=await req.json().catch(()=>null);
 if(typeof input?.message!=='string'||!input.message.trim()||input.message.length>4000)return respond({error:'消息长度无效'},400);
 const upstream=await fetch('https://api.deepseek.com/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:Deno.env.get('LIFE_OS_DEEPSEEK_MODEL')||'deepseek-chat',messages:[{role:'system',content:'你是个人成长伙伴。请用中文给出简洁具体的回答。'},{role:'user',content:input.message}],max_tokens:900})});
 if(!upstream.ok)return respond({error:'DeepSeek 请求失败，请检查模型、额度或稍后重试'},502);
 const answer=(await upstream.json()).choices?.[0]?.message?.content;
 return typeof answer==='string'&&answer.trim()?respond({analysis:answer,suggestions:[],next_actions:[]}):respond({error:'模型未返回正文'},502);
});
