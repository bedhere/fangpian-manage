import { Badge, Button, Card } from '@fangpian/ui';
import { useState, type FormEvent } from 'react';
import { dateText, iso, localDateTime, statusLabel, type Grade, type Mutate, type Row, type Task, type Workspace } from './types';
import { Empty, GradeSelect } from './ui';
import { blankTask, TaskInputs, type TaskFields } from './task-inputs';
import { RecordTools } from './record-tools';

function fieldsOf(task:Task):TaskFields {
  return {title:task.title,description:task.description,acceptanceCriteria:task.acceptanceCriteria,priority:task.priority,dueAt:localDateTime(task.dueAt),selfDifficulty:task.selfDifficulty??'B'};
}
function Reviewers({data}:{data:Workspace}) {
  const reviewers=data.taskRequestReviewers??[];
  return reviewers.length?<p className="text-sm leading-6 text-[#756d59]">当前审核导师：{reviewers.map(person=>person.name).join('、')}。对应导师审核通过后，该申请进入本人任务。</p>:<div role="status" className="rounded-xl bg-[#fff2be] p-4 text-sm leading-6"><p className="font-bold">当前没有有效绑定的审核导师，暂不能提交任务申请。</p><p>可以先保存草稿。请前往<a className="font-bold underline underline-offset-4" href="/ai-center?tab=my-mentors">我的导师</a>配置导师，待导师关系生效后再提交。</p></div>;
}
export function SelfTaskRequests({data,busy,mutate}:{data:Workspace;busy:boolean;mutate:Mutate}) {
  const [creating,setCreating]=useState(false);
  const mine=data.tasks.filter(row=>row.data.sourceType==='SELF'&&!row.data.approvedAt&&row.ownerId===data.user.id);
  return <section className="space-y-4 rounded-2xl border border-[#ead895] bg-[#fff9e4] p-4 sm:p-5" aria-label="我的任务申请">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-black">我的任务申请</h3><p className="mt-2 text-sm leading-6 text-[#756d59]">提出自己计划开展的工作，由对应导师确认价值、难度和交付期。审核通过前保留为申请，不进入已承接任务。</p></div><Button disabled={busy} onClick={()=>setCreating(value=>!value)}>{creating?'收起新申请':'提交任务审核'}</Button></div>
    <Reviewers data={data}/>
    {creating&&<TaskRequestEditor data={data} busy={busy} mutate={mutate} onSaved={()=>setCreating(false)}/>}
    {mine.map(row=><TaskRequestCard key={`${row.id}:${row.version}`} row={row} data={data} busy={busy} mutate={mutate}/>)}
    {!mine.length&&!creating&&<Empty>暂无待处理的自拟任务申请。需要附件时先保存草稿，再上传并提交审核。</Empty>}
  </section>;
}
function TaskRequestEditor({row,data,busy,mutate,onSaved}:{row?:Row<Task>;data:Workspace;busy:boolean;mutate:Mutate;onSaved?:()=>void}) {
  const [value,setValue]=useState<TaskFields>(()=>row?fieldsOf(row.data):blankTask());
  const [requestKey]=useState(()=>crypto.randomUUID());
  const canSubmit=(data.taskRequestReviewers??[]).length>0;
  const dirty=!row||JSON.stringify(value)!==JSON.stringify(fieldsOf(row.data));
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(busy)return;
    const submitter=(event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
    const submit=submitter?.value==='submit';if(submit&&!canSubmit)return;
    // Unedited saved drafts use their current version and the dedicated submit transition.
    const ok=row&&submit&&!dirty
      ?await mutate(`/task-requests/${row.id}/submit`,{version:row.version})
      :await mutate(row?`/task-requests/${row.id}`:'/task-requests',{...value,dueAt:iso(value.dueAt),submit,...(row?{version:row.version}:{requestKey})},row?'PATCH':'POST');
    if(ok)onSaved?.();
  }
  return <form className="space-y-4 rounded-xl border border-[#e3dbbf] bg-white p-4" onSubmit={event=>void save(event)}>
    <h4 className="text-lg font-black">{row?'编辑自拟任务草稿':'新建自拟任务申请'}</h4>
    <fieldset disabled={busy} className="space-y-4"><TaskInputs value={value} onChange={setValue} difficulty/>
      <p className="text-xs leading-6 text-[#756d59]">需要提交申请材料时，请先保存草稿，再到该申请的附件区上传。上传完成后再提交审核，已确认附件随申请版本冻结；此时还不是提交工作成果验收。</p>
      <div className="flex flex-wrap gap-3"><Button type="submit" name="intent" value="draft" variant="secondary" disabled={busy}>保存草稿</Button><Button type="submit" name="intent" value="submit" disabled={busy||!canSubmit}>{row&&dirty?'保存并提交审核':'提交对应导师审核'}</Button></div>
    </fieldset>
  </form>;
}
export function TaskRequestCard({row,data,busy:parentBusy,mutate,initialExpanded=false}:{row:Row<Task>;data:Workspace;busy:boolean;mutate:Mutate;initialExpanded?:boolean}) {
  const [uploading,setUploading]=useState(false);
  const [difficulty,setDifficulty]=useState<Grade>(row.data.selfDifficulty??'B');
  const [expanded,setExpanded]=useState(initialExpanded||row.status==='DRAFT');
  const busy=parentBusy||uploading;
  const pending=['PROPOSED','DEFERRED'].includes(row.status);
  const revisable=['PROPOSED','DEFERRED','REJECTED'].includes(row.status);
  const task=row.data;
  return <Card className="min-w-0 space-y-4 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="mb-2 flex flex-wrap gap-2"><Badge>自拟任务</Badge><Badge>{statusLabel(row.status)}</Badge></div><h4 className="break-words text-lg font-black">{task.title}</h4><p className="mt-2 text-xs text-[#756d59]">{task.priority} · 自评难度 {task.selfDifficulty??'未填写'} · 预计交付 {dateText(task.dueAt)} · v{row.version}</p>{task.proposedAt&&<p className="mt-1 text-xs text-[#756d59]">最近送审 {dateText(task.proposedAt)}</p>}</div><Button variant="secondary" disabled={uploading} onClick={()=>setExpanded(value=>!value)}>{expanded?'收起申请':'查看申请与操作'}</Button></div>
    {task.decisionComment&&<p className="whitespace-pre-wrap break-words rounded-xl bg-[#fff2be] p-3 text-sm">导师审核说明：{task.decisionComment}</p>}
    {expanded&&<div className="space-y-4">
      {row.status==='DRAFT'?<TaskRequestEditor row={row} data={data} busy={busy} mutate={mutate}/>:<><div><h5 className="text-sm font-black">简介与预期产出</h5><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{task.description}</p></div><div><h5 className="text-sm font-black">验收标准</h5><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{task.acceptanceCriteria}</p></div></>}
      {pending&&<form className="space-y-3" onSubmit={event=>{event.preventDefault();if(!busy)void mutate(`/tasks/${row.id}/difficulty`,{version:row.version,selfDifficulty:difficulty},'PATCH');}}><GradeSelect label="修改待审难度自评（导师确认前可修改）" value={difficulty} onChange={setDifficulty}/><Button variant="secondary" disabled={busy}>保存难度自评</Button></form>}
      {revisable&&<div className="space-y-3"><p className="text-xs leading-6 text-[#756d59]">申请材料在待审及暂缓期间锁定。需要修改简介、日期或附件时，可撤回为草稿，修改后重提；原审核记录保留。</p><Button variant="secondary" disabled={busy} onClick={()=>{if(window.confirm('确认将此申请转为草稿修改？原审核历史保留，修改后需要重新提交导师审核。'))void mutate(`/task-requests/${row.id}/revise`,{version:row.version});}}>{row.status==='REJECTED'?'修改并重新申请':'撤回为草稿修改'}</Button></div>}
      {uploading&&<p role="status" className="text-sm font-bold">附件上传中，请等待完成后保存或提交申请。</p>}
      {pending&&<p className="text-xs text-[#756d59]">送审材料已锁定{task.proposalFileIds?.length?`（${task.proposalFileIds.length}个确认附件）`:''}，导师批准后才成为进行中的本人任务。</p>}
      <RecordTools row={row} busy={busy} mutate={mutate} onUploadingChange={setUploading}/>
    </div>}
  </Card>;
}
