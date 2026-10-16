import assert from 'node:assert/strict';
const base='http://127.0.0.1:5175';
const headers={'Cookie':'__sites_local_auth=1','Content-Type':'application/json','Origin':base};
async function get(){const r=await fetch(base+'/api/life',{headers});assert.equal(r.status,200);return r.json()}
async function post(version,command,extra={}){const r=await fetch(base+'/api/life',{method:'POST',headers:{...headers,...extra},body:JSON.stringify({version,command})});return {status:r.status,body:await r.text().then(text=>{try{return JSON.parse(text)}catch{return {error:text}}})}}
let checks=0;
assert.equal((await fetch(base+'/api/life')).status,401);checks++;
assert.equal((await fetch(base+'/api/life',{headers:{'oai-authenticated-user-id':'forged','oai-authenticated-user-email':'forged@sites.test'}})).status,401);checks++;
let row=await get();const before=row.version;
assert.equal((await post(before,{action:'goal',title:'跨站写入不应成功'},{Origin:'https://other.invalid'})).status,403);checks++;
const first=await post(before,{action:'goal',title:'跨设备 API 验收目标'});assert.equal(first.status,200);checks++;
assert.equal((await post(before,{action:'review',content:'过期设备写入不应成功'})).status,409);checks++;
row=await get();assert.equal(row.version,first.body.version);assert(row.state.goals.some(g=>g.title==='跨设备 API 验收目标'));checks++;
const target=row.state.goals.at(-1);const projectsBefore=row.state.projects.length,tasksBefore=row.state.tasks.length;
let preview=await post(row.version,{action:'preview',message:'验证确认才创建任务',goalId:target.id});assert.equal(preview.status,200);assert.equal(preview.body.state.projects.length,projectsBefore);assert.equal(preview.body.state.tasks.length,tasksBefore);checks++;
const proposal=preview.body.result;
assert.equal((await post(preview.body.version,{action:'confirm',id:proposal.id,token:proposal.token,confirmed:false})).status,400);checks++;
assert.equal((await post(preview.body.version,{action:'confirm',id:proposal.id,token:'x'.repeat(40),confirmed:true})).status,403);checks++;
let confirmed=await post(preview.body.version,{action:'confirm',id:proposal.id,token:proposal.token,confirmed:true});assert.equal(confirmed.status,200);assert.equal(confirmed.body.state.projects.length,projectsBefore+1);assert.equal(confirmed.body.state.tasks.length,tasksBefore+5);checks++;
let repeated=await post(confirmed.body.version,{action:'confirm',id:proposal.id,token:proposal.token,confirmed:true});assert.equal(repeated.status,200);assert.equal(repeated.body.state.tasks.length,tasksBefore+5);assert.deepEqual(repeated.body.result,confirmed.body.result);checks++;
const freshDevice=await get();assert.equal(freshDevice.state.tasks.length,tasksBefore+5);assert.equal('proposals' in freshDevice.state,false);checks++;
assert.equal((await post(freshDevice.version,{action:'task',id:crypto.randomUUID(),done:true})).status,404);checks++;
const reviewed=await post(freshDevice.version,{action:'review',content:'云端接口验收：跨设备读取、版本冲突及重复确认检查通过。'});assert.equal(reviewed.status,200);checks++;
const noted=await post(reviewed.body.version,{action:'note',name:'测试导入笔记',content:'<script>仅作为纯文本保存，不执行</script>'});assert.equal(noted.status,200);checks++;
console.log(JSON.stringify({passed:checks,scope:'local-test-database',fresh_device_read:true,conflict_rejected:true,unauthenticated_and_forged_identity_rejected:true,confirm_idempotent:true}));
