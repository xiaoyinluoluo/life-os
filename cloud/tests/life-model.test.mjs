import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initialState,makePlan,applyConfirmedPlan,publicState} from '../app/life-model.mjs';
test('preview creates no project/task; confirmation is idempotent',()=>{
 const s=initialState('测试');const goalId=randomUUID();s.goals.push({id:goalId,title:'参赛'});
 const p=makePlan('完成演示',goalId,s,randomUUID(),'2026-10-16T01:00:00Z');
 assert.equal(s.projects.length,0);assert.equal(s.tasks.length,0);
 const result=applyConfirmedPlan(s,p,randomUUID,'2026-10-16T01:10:00Z');
 assert.equal(s.projects.length,1);assert.equal(s.tasks.length,5);
 assert.deepEqual(applyConfirmedPlan(s,p,randomUUID,'2026-10-16T01:11:00Z'),result);
 assert.equal(s.tasks.length,5);
});
test('reject expired, cancelled and another user goal without mutation',()=>{
 const s=initialState('A');const g=randomUUID();s.goals.push({id:g,title:'目标'});
 assert.throws(()=>makePlan('测试',randomUUID(),s,randomUUID(),'2026-10-16T01:00:00Z'));
 const p=makePlan('测试',g,s,randomUUID(),'2026-10-16T01:00:00Z');
 assert.throws(()=>applyConfirmedPlan(s,p,randomUUID,'2026-10-16T02:00:00Z'));
 p.status='cancelled';assert.throws(()=>applyConfirmedPlan(s,p,randomUUID,'2026-10-16T01:01:00Z'));
 assert.equal(s.projects.length,0);assert.equal(s.tasks.length,0);
});
test('account state is independent and public API omits confirmation material',()=>{
 const a=initialState('A'),b=initialState('B');a.notes.push({content:'仅属于 A'});a.proposals.push({tokenHash:'secret'});
 assert.equal(b.notes.length,0);assert.equal('proposals' in publicState(a),false);
});
