import { Badge, Button, Card } from '@fangpian/ui';
import { useEffect, useRef, useState } from 'react';
import { field, request, errorText, iso, localDateTime, type Grade, type GrowthRating, type Mutate, type Row, type Workspace } from './types';
import { Empty, ErrorBox, GradeSelect, Section } from './ui';
import { TasksTab } from './tasks';
import { IvyCard } from './ivy';
import { NoteCard } from './notes';
import { RecordSnapshot } from './record-snapshot';
import { MentorRequestQueue } from './mentor-requests';
export function ApprovalsTab({ data, busy, mutate }: {
    data: Workspace;
    busy: boolean;
    mutate: Mutate;
}) { const ivy = data.ivy.filter(r => r.canReview && r.dateKey < data.serverDate && !r.data.review); const notes = data.notes.filter(r => r.canReview && r.status === 'SUBMITTED'); const links = data.links.filter(r => r.canReview && r.status === 'PENDING'); const appeals = data.appeals.filter(r => r.canReview && r.status !== 'RESOLVED'); return <Section title="待审批与复核" description="按记录当前版本处理。笔记计划质量、行动价值、交付质量分别审批；任意有效导师完成后，其余审核人的同项待办结束。"><Card className="flex flex-wrap gap-5 bg-[#fff8dc] p-5 text-sm font-bold"><span>待评日报 {ivy.length}</span><span>待评学习笔记 {notes.length}</span><span>待审证据关联 {links.length}</span><span>待处理复核 {appeals.length}</span></Card><MentorRequestQueue data={data} busy={busy} mutate={mutate}/><TasksTab data={data} busy={busy} mutate={mutate} onlyPending/><h3 className="text-xl font-black">日报复盘质量</h3>{ivy.length ? ivy.map(r => <IvyCard key={`${r.id}:${r.version}`} row={r} data={data} busy={busy} mutate={mutate}/>) : <Empty>暂无待评日报</Empty>}<h3 className="text-xl font-black">学习笔记计划质量</h3>{notes.length ? notes.map(r => <NoteCard key={`${r.id}:${r.version}`} row={r} data={data} busy={busy} mutate={mutate}/>) : <Empty>暂无待评学习笔记</Empty>}<h3 className="text-xl font-black">已有任务证据关联</h3>{links.length ? links.map(r => <LinkApproval key={`${r.id}:${r.version}`} row={r} data={data} busy={busy} mutate={mutate}/>) : <Empty>暂无待审关联</Empty>}<h3 className="text-xl font-black">评分与价值复核</h3>{appeals.length ? appeals.map(r => <AppealApproval key={`${r.id}:${r.version}`} row={r} busy={busy} mutate={mutate}/>) : <Empty>暂无待处理复核</Empty>}{data.appeals.length > 0 && <details><summary className="cursor-pointer font-bold">全部可见复核记录（{data.appeals.length}）</summary>{data.appeals.map(r => <Card key={r.id} className="mt-3 p-4 text-sm"><p className="font-bold">{r.ownerName} · {r.status} · v{r.version}</p><p className="mt-2 whitespace-pre-wrap break-words">{r.data.reason}</p>{r.data.comment && <p className="mt-2">处理说明：{r.data.comment}</p>}</Card>)}</details>}</Section>; }
export function LinkApproval({ row, data, busy, mutate }: {
    row: Workspace['links'][number];
    data: Workspace;
    busy: boolean;
    mutate: Mutate;
}) { const [comment, setComment] = useState(''); return <Card className="space-y-3 p-5"><p className="font-bold">{row.ownerName} → {data.tasks.find(t => t.id === row.data.taskId)?.data.title ?? '既有任务'}</p><p className="whitespace-pre-wrap break-words text-sm">{row.data.text}</p><label className="block text-sm font-bold">审核说明 / 拒绝理由<textarea className={field} value={comment} onChange={e => setComment(e.target.value)}/></label><div className="flex flex-wrap gap-3"><Button disabled={busy} onClick={() => void mutate(`/links/${row.id}/decision`, { version: row.version, decision: 'APPROVE', comment })}>批准关联（不重复计分）</Button><Button variant="secondary" disabled={busy || !comment.trim()} onClick={() => void mutate(`/links/${row.id}/decision`, { version: row.version, decision: 'REJECT', comment })}>拒绝关联</Button></div></Card>; }
export function AppealApproval({row,busy,mutate}:{row:Workspace['appeals'][number];busy:boolean;mutate:Mutate}) {
    const growth=row.data.targetKind==='GROWTH';
    const [target,setTarget]=useState<Row<Record<string,unknown>>>();
    const [error,setError]=useState('');const [reading,setReading]=useState(false);
    const [decision,setDecision]=useState('UPHOLD');const [comment,setComment]=useState('');
    const [grade,setGrade]=useState<Grade>('A');const [growthGrade,setGrowthGrade]=useState<GrowthRating>('A');
    const [difficulty,setDifficulty]=useState<Grade>('B');const [changeGrade,setChangeGrade]=useState(false);const [changeDifficulty,setChangeDifficulty]=useState(false);
    const [changeDue,setChangeDue]=useState(false);const [due,setDue]=useState('');
    const alive=useRef(true);const readController=useRef<AbortController|null>(null);
    useEffect(()=>{alive.current=true;return()=>{alive.current=false;readController.current?.abort();};},[]);
    async function readTarget(){
        const id=row.data.targetRecordId??row.data.recordId;
        if(!id){setError('来源记录标识缺失，请刷新工作区');return;}
        const controller=new AbortController();readController.current?.abort();readController.current=controller;
        setReading(true);setError('');setTarget(undefined);
        try{
            const result=await request<Row<Record<string,unknown>>>(growth?`/growth-plans/${id}`:`/records/${id}`,controller.signal);
            if(alive.current&&!controller.signal.aborted){setTarget(result);setChangeDue(false);setDue(typeof result.data.dueAt==='string'?localDateTime(result.data.dueAt):'');if(growth&&['S','A+','A','A-','B','C'].includes(String(result.data.rating)))setGrowthGrade(result.data.rating as GrowthRating);}
        }catch(error){if(alive.current&&!controller.signal.aborted)setError(errorText(error));}
        finally{if(alive.current&&!controller.signal.aborted)setReading(false);}
    }
    const approvedTask=!growth&&target?.kind==='TASK'&&typeof target.data.approvedAt==='string';
    const dueValid=decision!=='CHANGE'||!changeDue||approvedTask&&Number.isFinite(new Date(due).getTime())&&new Date(due).getTime()>new Date(String(target.data.dueAt)).getTime();
    return <Card className="space-y-4 p-5">
      <p className="font-black">{row.ownerName} · {growth?'最终综合评级':'评分与价值'}复核 <Badge>来源 v{row.data.recordVersion??row.data.targetVersion}</Badge></p>
      <p className="whitespace-pre-wrap break-words text-sm">{row.data.reason}</p><ErrorBox message={error}/>
      {row.data.targetSnapshot!=null&&<details><summary className="cursor-pointer text-sm font-bold">申请时的原始结果与版本</summary><RecordSnapshot value={row.data.targetSnapshot}/></details>}
      <Button variant="secondary" disabled={busy||reading} onClick={()=>void readTarget()}>核对来源记录当前版本</Button>
      {target&&<details open><summary className="cursor-pointer font-bold">当前来源 v{target.version} · {target.ownerName}</summary><RecordSnapshot value={target}/></details>}
      <form className="space-y-4" onSubmit={event=>{
        event.preventDefault();if(!target||!dueValid||growth&&!['UPHOLD','CHANGE'].includes(decision))return;
        void mutate(`/appeals/${row.id}/resolve`,{version:row.version,targetVersion:target.version,decision,comment,
          ...(decision==='CHANGE'&&(growth||changeGrade)?{grade:growth?growthGrade:grade}:{}),
          ...(decision==='CHANGE'&&!growth&&changeDifficulty?{confirmedDifficulty:difficulty}:{}),
          ...(decision==='CHANGE'&&approvedTask&&changeDue?{dueAt:iso(due)}:{})});
      }}>
        <label className="block text-sm font-bold">处理决定<select className={field} value={decision} onChange={event=>setDecision(event.target.value)}><option value="UPHOLD">维持原结果</option><option value="CHANGE">调整结果（保留历史与理由）</option>{!growth&&<option value="REOPEN">重新开启审核</option>}</select></label>
        {decision==='CHANGE'&&(growth?<label className="block text-sm font-bold">调整后最终综合评级（六档）<select required className={field} value={growthGrade} onChange={event=>setGrowthGrade(event.target.value as GrowthRating)}>{['S','A+','A','A-','B','C'].map(value=><option key={value}>{value}</option>)}</select></label>:<div className="space-y-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={changeGrade} onChange={event=>setChangeGrade(event.target.checked)}/>调整质量评分</label>{changeGrade&&<GradeSelect label="调整后质量" value={grade} onChange={setGrade}/>}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={changeDifficulty} onChange={event=>setChangeDifficulty(event.target.checked)}/>调整确认难度</label>{changeDifficulty&&<GradeSelect label="调整后难度" value={difficulty} onChange={setDifficulty}/>}</div>)}
        {decision==='CHANGE'&&approvedTask&&<div className="space-y-3 rounded-xl bg-[#fff6d8] p-4"><label className="flex items-start gap-2 text-sm font-bold"><input type="checkbox" checked={changeDue} onChange={event=>setChangeDue(event.target.checked)}/>调整交付期（需求变动 / 外部阻塞）</label>{changeDue&&<label className="block text-sm font-bold">裁定后的交付期（仅可延后，设备时区）<input required type="datetime-local" className={field} min={typeof target.data.dueAt==='string'?localDateTime(target.data.dueAt):undefined} value={due} onChange={event=>setDue(event.target.value)}/></label>}<p className="text-xs leading-6 text-[#756d59]">申请复核后，在争议裁定前保持待核定，不按未交付0分处理。裁定须说明原因，保留原交付期与历史，随后按新交付期计算。</p>{changeDue&&!dueValid&&<p className="text-sm text-red-800">请选择晚于原交付期的有效时间。</p>}</div>}
        <label className="block text-sm font-bold">复核依据与处理说明<textarea required minLength={2} className={field} value={comment} onChange={event=>setComment(event.target.value)}/></label>
        <p className="text-xs text-[#756d59]">须由主管或另一位有权限的导师处理，不能由原决定人独自终结。{growth?'综合评级复核仅可维持或调整六档评级，不改变任务难度。':''}</p>
        <Button disabled={busy||!target||reading||!dueValid||comment.trim().length<2||(decision==='CHANGE'&&!growth&&!changeGrade&&!changeDifficulty&&!(approvedTask&&changeDue))}>确认处理复核</Button>
      </form>
    </Card>;
}
