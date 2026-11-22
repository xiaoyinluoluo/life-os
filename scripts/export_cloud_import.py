"""Preview and export local Life OS records for an authenticated browser import."""
import argparse, json, sqlite3, uuid, hashlib
from pathlib import Path

KINDS = {'goals':'goal','projects':'project','tasks':'task','sources':'note'}
NS = uuid.UUID('b42f8231-9af7-4a8d-a1d8-1505e0948242')
def uid(kind, key): return str(uuid.uuid5(NS, f'life-os-local:{kind}:{key}'))
def rows(db, table):
    db.row_factory=sqlite3.Row
    return [dict(row) for row in db.execute(f'SELECT * FROM {table}')]
def export(path, include_notes, vault=None):
    db=sqlite3.connect(Path(path).resolve().as_uri()+'?mode=ro',uri=True)
    profile=rows(db,'user_profiles')[0]
    output=[{'kind':'profile','id':'main','data':{'name':profile['name'],'stage':profile['background'][:200] or '探索与成长','goal':'; '.join(json.loads(profile['goals'] or '[]'))[:1000],'status':profile['background'][:2000], 'local':profile}}]
    for table,kind in KINDS.items():
        for row in rows(db,table):
            if row.get('status')=='deleted': continue
            if kind=='note' and row['file_path'] not in include_notes: continue
            ident=uid(kind,row['id'])
            if kind=='goal': data={'id':ident,'title':row['title'],'outcome':row['outcome'],'status':row['status'],'decisions':json.loads(row['decisions'] or '[]'),'isDemo':bool(row['is_demo'])}
            elif kind=='project': data={'id':ident,'goalId':uid('goal',row['goal_id']),'title':row['title'],'description':row['description'],'isDemo':bool(row['is_demo'])}
            elif kind=='task': data={'id':ident,'projectId':uid('project',row['project_id']),'title':row['title'],'status':row['status'],'dueDate':row['due_date'] or '', 'priority':row['priority'],'completedAt':row['completed_at'], 'review':row['review'],'focusDate':row['focus_date'],'archived':bool(row['archived']),'isDemo':bool(row['is_demo'])}
            else:
                source=Path(row['file_path']).resolve()
                root=Path(vault).resolve() if vault else None
                if root is None or not source.is_relative_to(root) or not source.is_file():
                    raise ValueError(f'选定的笔记不可读取或不在指定 Vault 中：{source}')
                content=source.read_text(encoding='utf-8')
                data={'id':ident,'name':row['file_name'],'content':content,'sourcePath':str(source.relative_to(root)),'summaryOnly':False,'updatedAt':row['updated_at'],'sha256':hashlib.sha256(content.encode('utf-8')).hexdigest()}
            output.append({'kind':kind,'id':ident,'data':data})
    for row in rows(db,'memories'):
        ident=uid('note',f"memory:{row['id']}")
        output.append({'kind':'note','id':ident,'data':{'id':ident,'name':f"记忆 · {row['kind']}",'content':row['content'],'updatedAt':row['created_at'],'isDemo':bool(row['is_demo']),'source':'local-memory'}})
    for row in rows(db,'workbench_records'):
        if row['key'].startswith('experiment:'):
            output.append({'kind':'decision','id':uid('decision',row['key']),'data':json.loads(row['value'])})
    for row in rows(db,'companion_chat'):
        for index,turn in enumerate(json.loads(row['turns'] or '[]')):
            ident=uid('message',f"{row['id']}:{turn.get('id',index)}")
            output.append({'kind':'message','id':ident,'data':{'id':ident,'message':turn.get('message',''),'reply':turn.get('reply',{}),'model':turn.get('model',''),'createdAt':'','source':'local-sqlite'}})
    return output
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('database');parser.add_argument('--vault');parser.add_argument('--include-note',action='append',default=[]);parser.add_argument('--output');args=parser.parse_args()
    records=export(args.database,set(args.include_note),args.vault);summary={k:sum(r['kind']==k for r in records) for k in sorted(set(r['kind'] for r in records))}
    print(json.dumps({'counts':summary,'selected_note_paths':args.include_note,'missing':['未明确选择的 Obsidian 笔记不会上传'],'delete_protection':'此工具只导出，永不删除本地或云端记录','repeat_import':'稳定 ID，重复导入应跳过'},ensure_ascii=False,indent=2))
    if args.output:
        out=Path(args.output)
        if out.exists(): raise SystemExit('输出文件已存在，请先另存。')
        out.write_text(json.dumps({'format':'life-os-import-v1','records':records},ensure_ascii=False),encoding='utf-8')
        print('sha256:',hashlib.sha256(out.read_bytes()).hexdigest())
