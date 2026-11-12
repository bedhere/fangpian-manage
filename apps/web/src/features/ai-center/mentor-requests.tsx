import { Badge, Button, Card } from '@fangpian/ui';
import { useState } from 'react';
import { dateText, field, type Member, type MentorRequest, type Mutate, type Row, type Workspace } from './types';
import { Empty, Section } from './ui';
import { MentorSelection, mentorSelectionValid } from './mentor-selection';

const requestStatus:Record<MentorRequest['status'],string>={PENDING:'待负责人审核',APPROVED:'已通过并生效',REJECTED:'已驳回',CANCELLED:'已撤回',SUPERSEDED:'已被管理配置更新取代'};
function personName(data:Workspace,id:string|null){return id?data.people.find(person=>person.id===id)?.name??'历史导师（当前不可选）':'尚未配置';}
export function MentorNames({data,ai,departments}:{data:Workspace;ai:string|null;departments:string[]}){
  return <dl className="space-y-2 text-sm"><div><dt className="font-bold">AI导师</dt><dd className="mt-1">{personName(data,ai)}</dd></div><div><dt className="font-bold">部门导师</dt><dd className="mt-1 flex flex-wrap gap-2">{departments.length?departments.map(id=><span className="rounded-lg bg-[#fff1bc] px-2 py-1" key={id}>{personName(data,id)}</span>):'尚未配置'}</dd></div></dl>;
}
export function RequestResult({request,data}:{request:MentorRequest;data:Workspace}){
  return <div className="space-y-3 rounded-xl border border-[#e6dfca] p-4"><div className="flex flex-wrap justify-between gap-2"><h4 className="font-black">最近一次导师申请</h4><Badge>{requestStatus[request.status]}</Badge></div><p className="text-xs text-[#756d59]">提交于 {dateText(request.submittedAt)}</p><MentorNames data={data} ai={request.aiMentorId} departments={request.departmentMentorIds}/>{request.comment&&<p className="whitespace-pre-wrap break-words text-sm">申请说明：{request.comment}</p>}{request.reviewerName&&<p className="text-sm">审核人：{request.reviewerName} · {dateText(request.reviewedAt)}</p>}{request.decisionComment&&<p className="whitespace-pre-wrap break-words text-sm">审核说明：{request.decisionComment}</p>}{request.status==='SUPERSEDED'&&<p className="text-sm text-[#756d59]">管理者已直接更新生效配置，此旧申请不能覆盖当前导师。</p>}</div>;
}
export function MyMentorsTab({data,busy,mutate}:{data:Workspace;busy:boolean;mutate:Mutate}){
  const row=data.members.find(member=>member.ownerId===data.user.id);
  return <Section title="我的导师" description="自行选择AI导师与部门导师，提交给指定AI总负责人审核。申请、重提及撤回均不改变当前生效关系，审核通过后才生效。">{row?<MyMentorRequest key={`${row.id}:${row.version}`} row={row} data={data} busy={busy} mutate={mutate}/>:<Empty>当前没有可配置的培养成员档案，请联系负责人核对培养身份。</Empty>}</Section>;
}
function MyMentorRequest({row,data,busy,mutate}:{row:Row<Member>;data:Workspace;busy:boolean;mutate:Mutate}){
  const request=row.data.mentorRequest;
  const initial=request?.status==='PENDING'?request:row.data;
  const [ai,setAi]=useState(initial.aiMentorId??'');
  const [departments,setDepartments]=useState(initial.departmentMentorIds);
  const [comment,setComment]=useState(request?.status==='PENDING'?request.comment:'');
  const selection=mentorSelectionValid(data,row.ownerId,ai,departments);
  const available=data.mentorApprover?.available===true;
  const approver=data.mentorApprover?.name||'示例员工0654';
  return <div className="space-y-5"><Card className="space-y-4 bg-[#fff8dc] p-5"><div className="flex flex-wrap justify-between gap-2"><h3 className="text-xl font-black">当前生效导师</h3><Badge>{row.data.active?'培养中':'已停用'}</Badge></div><MentorNames data={data} ai={row.data.aiMentorId} departments={row.data.departmentMentorIds}/>{row.data.legacyMentorId&&(!row.data.aiMentorId||row.data.departmentMentorIds.length===0)&&<p className="text-sm">原带教导师：{personName(data,row.data.legacyMentorId)}（类型待确认，审核前保留原关系）</p>}<p className="text-xs text-[#756d59]">这里显示已生效配置；待审申请不会替换这些导师。</p></Card>{request&&<RequestResult request={request} data={data}/>}<Card className="space-y-4 p-5"><h3 className="text-xl font-black">{request?.status==='PENDING'?'修改并重提导师申请':'申请配置导师'}</h3><p className="text-sm leading-6 text-[#756d59]">指定审核负责人：{approver}。AI导师须为AI部门在职员工，部门导师至少1名，双方不能重复。</p>{!available&&<p role="alert" className="rounded-xl bg-[#fff1bc] p-4 text-sm font-bold">指定负责人{approver}当前不可用，暂不能提交或重提导师申请。当前生效配置保持不变，请联系负责人处理。</p>}<form className="space-y-4" onSubmit={event=>{event.preventDefault();if(!available||!selection.complete)return;void mutate('/mentor-requests',{version:row.version,aiMentorId:ai,departmentMentorIds:departments,comment});}}><MentorSelection data={data} ownerId={row.ownerId} ai={ai} setAi={setAi} departments={departments} setDepartments={setDepartments} busy={busy}/><label className="block text-sm font-bold">申请说明（选填）<textarea maxLength={1000} className={field} value={comment} disabled={busy} onChange={event=>setComment(event.target.value)}/></label><p className="text-xs leading-6 text-[#756d59]">提交后等待{approver}审核。重提会以新的申请版本重新核对，原有导师不会提前更换。</p><div className="flex flex-wrap gap-3"><Button disabled={busy||!available||!selection.complete}>{request?.status==='PENDING'?'保存并重新提交申请':'提交导师申请'}</Button>{request?.status==='PENDING'&&<Button type="button" variant="secondary" disabled={busy} onClick={()=>{if(window.confirm('确认撤回当前待审导师申请？当前生效导师保持不变。'))void mutate('/mentor-requests/cancel',{version:row.version});}}>撤回待审申请</Button>}</div></form></Card></div>;
}
export function MentorRequestQueue({data,busy,mutate}:{data:Workspace;busy:boolean;mutate:Mutate}){
  if(!data.user.canApproveMentors&&!data.user.isManager)return null;
  const pending=data.members.filter(member=>member.data.mentorRequest?.status==='PENDING');
  return <section className="space-y-4" aria-label="导师配置申请审核"><div><h3 className="text-xl font-black">导师配置申请{pending.length?`（${pending.length}）`:''}</h3><p className="mt-2 text-sm leading-6 text-[#756d59]">仅指定AI总负责人{data.mentorApprover?.name||'示例员工0654'}可批准或驳回；管理员身份本身不授予此审批权限。</p></div>{!pending.length?<Empty>暂无待审导师配置申请</Empty>:pending.map(row=><MentorRequestApproval key={`${row.id}:${row.version}:${row.data.mentorRequest?.id}`} row={row} data={data} busy={busy} mutate={mutate}/>)}</section>;
}
export function MentorRequestApproval({row,data,busy,mutate}:{row:Row<Member>;data:Workspace;busy:boolean;mutate:Mutate}){
  const [comment,setComment]=useState('');const request=row.data.mentorRequest!;
  const canReview=data.user.canApproveMentors&&data.mentorApprover?.available===true&&row.ownerId!==data.user.id;
  function review(decision:'APPROVE'|'REJECT'){
    if(!canReview||decision==='REJECT'&&comment.trim().length<2)return;
    void mutate(`/members/${row.ownerId}/mentor-request/review`,{version:row.version,requestId:request.id,decision,comment});
  }
  return <Card className="space-y-4 p-5"><div className="flex flex-wrap justify-between gap-2"><h4 className="text-lg font-black">{row.ownerName} · 导师变更申请</h4><Badge>待审核 · v{row.version}</Badge></div><p className="text-xs text-[#756d59]">提交于 {dateText(request.submittedAt)}</p><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-3 rounded-xl bg-[#f7f4e9] p-4"><h5 className="font-black">当前生效</h5><MentorNames data={data} ai={row.data.aiMentorId} departments={row.data.departmentMentorIds}/>{row.data.legacyMentorId&&(!row.data.aiMentorId||row.data.departmentMentorIds.length===0)&&<p className="text-sm">原带教导师：{personName(data,row.data.legacyMentorId)}（类型待确认，审核前保留原关系）</p>}</div><div className="space-y-3 rounded-xl bg-[#fff5cc] p-4"><h5 className="font-black">申请变更为</h5><MentorNames data={data} ai={request.aiMentorId} departments={request.departmentMentorIds}/></div></div><p className="whitespace-pre-wrap break-words text-sm">申请说明：{request.comment||'未附加说明'}</p>{canReview?<form className="space-y-3" onSubmit={event=>{event.preventDefault();review('APPROVE');}}><label className="block text-sm font-bold">审核说明（驳回至少2字）<textarea maxLength={1000} disabled={busy} className={field} value={comment} onChange={event=>setComment(event.target.value)}/></label><div className="flex flex-wrap gap-3"><Button disabled={busy}>通过并使导师配置生效</Button><Button type="button" variant="secondary" disabled={busy||comment.trim().length<2} onClick={()=>review('REJECT')}>驳回申请</Button></div></form>:<p className="text-sm text-[#756d59]">等待指定负责人审核，当前账号无此申请的审批权限。</p>}</Card>;
}
