import { createRecord, getRecord, type RecordKind } from './records';

const allowed = new Set<RecordKind>(['profile','goal','project','task','review','note','message','decision','setting']);
export type ImportItem = {kind:RecordKind;id:string;data:Record<string,unknown>};
export type ImportPreview = {items:ImportItem[];counts:Record<string,number>;existing:ImportItem[];missing:ImportItem[];conflicts:ImportItem[]};

export async function previewImport(text:string):Promise<ImportPreview>{
 const file=JSON.parse(text);
 if(file?.format!=='life-os-import-v1'||!Array.isArray(file.records))throw new Error('迁移文件格式不正确。');
 if(file.records.length>100000)throw new Error('迁移文件记录过多，请分批导入。');
 const items:ImportItem[]=file.records.map((r:ImportItem)=>{
  if(!allowed.has(r.kind)||typeof r.id!=='string'||!r.id||r.id.length>200||!r.data||typeof r.data!=='object'||Array.isArray(r.data))throw new Error('迁移文件含无效记录。');
  return r;
 });
 const keys=new Set<string>();for(const r of items){const key=`${r.kind}:${r.id}`;if(keys.has(key))throw new Error('迁移文件含重复 ID。');keys.add(key)}
 const existing:ImportItem[]=[],missing:ImportItem[]=[],conflicts:ImportItem[]=[];
 for(const item of items){const old=await getRecord(item.kind,item.id);if(!old||old.deleted_at)missing.push(item);else if(JSON.stringify(old.data)===JSON.stringify(item.data))existing.push(item);else conflicts.push(item)}
 return {items,existing,missing,conflicts,counts:items.reduce((a,r)=>(a[r.kind]=(a[r.kind]||0)+1,a),{} as Record<string,number>)};
}

export async function importMissing(preview:ImportPreview,onProgress:(done:number)=>void){
 let done=0;
 for(const item of preview.missing){
  const current=await getRecord(item.kind,item.id);
  if(current)throw new Error(`记录 ${item.kind}/${item.id} 已被另一设备创建，请重新预览。`);
  await createRecord(item.kind,item.id,item.data);
  onProgress(++done);
 }
 return done;
}
