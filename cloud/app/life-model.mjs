export const today = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function initialState(name) {
  return {profile:{name:name || '我的 Life OS',stage:'探索与成长',goal:'',status:''},goals:[],projects:[],tasks:[],reviews:[],notes:[],messages:[],proposals:[]};
}
export function reply(message, state) {
  const goal=state.profile.goal || state.goals[0]?.title || '你正在探索的方向';
  return {analysis:`你提到了“${message.slice(0,100)}”。结合当前目标“${goal}”，可以先把问题缩小到今天能验证的一步。`,suggestions:['写下你最想得到的具体结果。','选一个今天能完成的小尝试，并给它留出时间。','完成后记录结果，再决定下一步。'],next_actions:['明确一个可观察的结果','完成一次 25 分钟的尝试','用三句话记录收获和阻碍']};
}
export function makePlan(message, goalId, state, id, time) {
  if(!state.goals.some(g=>g.id===goalId)) throw new Error('请先选择自己的目标。');
  return {id,goalId,title:message.slice(0,70),description:message,createdAt:time,expiresAt:new Date(Date.parse(time)+1800000).toISOString(),status:'pending',tasks:['明确目标和验收标准','查找并整理必要资料','完成一个最小可展示成果','验证结果并收集反馈','记录复盘和下一步'],result:null};
}
export function publicState(state) { const {proposals,...visible}=state; return visible; }
export function applyConfirmedPlan(state, proposal, uuid, time) {
  if(proposal.status==='executed') return proposal.result;
  if(proposal.status!=='pending'||Date.parse(proposal.expiresAt)<=Date.parse(time)) throw new Error('方案已过期或已取消，请重新预览。');
  const project={id:uuid(),goalId:proposal.goalId,title:proposal.title,description:proposal.description,createdAt:time};
  const tasks=proposal.tasks.map((title,i)=>({id:uuid(),projectId:project.id,title,status:'todo',dueDate:today(),priority:i===0?'high':'medium',completedAt:null}));
  state.projects.push(project);state.tasks.push(...tasks);
  proposal.status='executed';proposal.result={projectId:project.id,taskIds:tasks.map(t=>t.id)};
  return proposal.result;
}
