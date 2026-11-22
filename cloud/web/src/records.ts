import { supabase } from './client';
export type RecordKind = 'profile'|'goal'|'project'|'task'|'review'|'note'|'message'|'decision'|'setting';
export type CloudRecord = { user_id:string; kind:RecordKind; id:string; data:Record<string,unknown>; version:number; updated_at:string; deleted_at:string|null };
async function owner() {
  const {data,error}=await supabase.auth.getUser();
  if(error||!data.user) throw new Error('请先登录。');
  return data.user.id;
}
export async function listRecords(kind:RecordKind, page=0) {
  if(!Number.isInteger(page)||page<0) throw new Error('页码无效');
  const user=await owner();
  const {data,error}=await supabase.from('life_records').select('user_id,kind,id,version,updated_at,deleted_at,data').eq('user_id',user).eq('kind',kind).is('deleted_at',null).order('id').range(page*50,page*50+49);
  if(error) throw error;
  return data as CloudRecord[];
}
export async function countRecords(kind:RecordKind){
  const user=await owner();
  const {count,error}=await supabase.from('life_records').select('*',{count:'exact',head:true}).eq('user_id',user).eq('kind',kind).is('deleted_at',null);
  if(error)throw error;
  return count||0;
}
export async function createRecord(kind:RecordKind, id:string, data:Record<string,unknown>) {
  const user=await owner();
  const result=await supabase.from('life_records').insert({user_id:user,kind,id,data}).select().single();
  if(result.error) throw result.error;
  return result.data as CloudRecord;
}
export async function getRecord(kind:RecordKind, id:string) {
  const user=await owner();
  const {data,error}=await supabase.from('life_records').select('user_id,kind,id,version,updated_at,deleted_at,data').eq('user_id',user).eq('kind',kind).eq('id',id).maybeSingle();
  if(error) throw error;
  return data as CloudRecord|null;
}
export async function updateRecord(record:CloudRecord, data:Record<string,unknown>, remove=false) {
  const user=await owner();
  if(record.user_id!==user) throw new Error('账号已切换，请重新读取数据。');
  const result=await supabase.from('life_records').update({data,version:record.version,deleted_at:remove?new Date().toISOString():null}).eq('user_id',user).eq('kind',record.kind).eq('id',record.id).eq('version',record.version).select();
  if(result.error) throw result.error;
  if(!result.data?.length) throw new Error('另一台设备已修改此记录，请重新读取后决定如何合并。');
  return result.data[0] as CloudRecord;
}
