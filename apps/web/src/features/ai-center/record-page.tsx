'use client';
import Link from 'next/link';
import { Button, Card } from '@fangpian/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { ErrorBox } from './ui';
import { TaskCard } from './tasks';
import { TaskRequestCard } from './task-requests';
import { IvyCard, IvyTab } from './ivy';
import { NoteCard, NotesTab } from './notes';
import { LinkApproval, AppealApproval } from './approvals';
import { MyMentorsTab, MentorNames, MentorRequestApproval, RequestResult } from './mentor-requests';
import { RecordSnapshot } from './record-snapshot';
import { errorText, monday, request, write, type Ivy, type Member, type Mutate, type Note, type Row, type Task, type Workspace } from './types';

function recordWeek(row:Row):string|undefined {
  let day=row.dateKey;
  if(row.kind==='TASK'&&typeof row.data.dueAt==='string'){
    const stamp=Date.parse(row.data.dueAt);
    if(Number.isFinite(stamp))day=new Date(stamp+8*3600000).toISOString().slice(0,10);
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day+'T00:00:00Z'))?monday(day):undefined;
}
type Notice = 'ivy-missing'|'learning-missing'|undefined;
export function AiRecordPage({recordId,notice:rawNotice,noticeDate:rawDate}:{recordId:string;notice?:string;noticeDate?:string}) {
  const identity=useSessionStore(s=>s.identity);
  const notice:Notice=rawNotice==='ivy-missing'||rawNotice==='learning-missing'?rawNotice:undefined;
  const validDate=typeof rawDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(rawDate)&&Number.isFinite(Date.parse(rawDate))&&new Date(rawDate).toISOString().slice(0,10)===rawDate;
  const noticeDate=validDate?rawDate:undefined;
  const signature=identity?`${identity.id}:${[...identity.roles].sort()}:${[...identity.permissions].sort()}`:'';
  return identity?<RecordPage key={`${signature}:${recordId}:${notice}:${noticeDate}`} recordId={recordId} notice={notice} noticeDate={noticeDate}/>:<main className="mx-auto max-w-6xl p-7"><Card className="space-y-3 p-7"><p role="status">正在确认登录身份，请先登录后查看消息事项。</p><Link href="/" className="font-bold underline">前往登录</Link></Card></main>;
}
function RecordPage({recordId,notice,noticeDate}:{recordId:string;notice:Notice;noticeDate?:string}) {
  const [value,setValue]=useState<{row:Row;data:Workspace}>();
  const [error,setError]=useState('');const [message,setMessage]=useState('');
  const [readFailed,setReadFailed]=useState(false);
  const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);
  const [revision,setRevision]=useState(0);
  const alive=useRef(true);const writing=useRef(false);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{
    const controller=new AbortController();let active=true;
    async function load(){
      // Existing record endpoint enforces current identity and ownership/mentor permissions.
      const row=await request<Row>(`/records/${encodeURIComponent(recordId)}`,controller.signal);
      const week=row.kind==='MEMBER'&&notice&&noticeDate?monday(noticeDate):recordWeek(row);
      const data=await request<Workspace>(`/workspace${week?`?week=${encodeURIComponent(week)}`:''}`,controller.signal);
      if(active)setValue({row,data});
    }
    void load().catch(reason=>{if(active){setError(errorText(reason));setReadFailed(true);}}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;controller.abort();};
  },[recordId,revision,notice,noticeDate]);
  const mutate:Mutate=useCallback(async(path,body,method='POST')=>{
    if(writing.current)return false;
    writing.current=true;setBusy(true);setError('');setMessage('');
    try{
      await write(path,body,method);
      if(!alive.current)return false;
      setMessage('操作已保存，正在更新当前事项');setReadFailed(false);setLoading(true);setRevision(v=>v+1);return true;
    }catch(reason){if(alive.current)setError(errorText(reason));return false;}
    finally{writing.current=false;if(alive.current)setBusy(false);}
  },[]);
  return <main className="min-h-screen bg-[#fcfaf2] px-4 py-7 text-[#302d24] sm:px-6"><div className="mx-auto max-w-6xl space-y-5">
    <header className="space-y-3"><Link href="/ai-center" className="text-sm font-bold underline">← 返回AI中台</Link><h1 className="text-3xl font-black">消息对应事项</h1><p className="text-sm text-[#756d59]">按当前权限与最新状态处理，历史消息不会重复生成任务或更改原有结果。</p></header>
    <ErrorBox message={error}/>{message&&<p role="status" className="rounded-xl bg-[#fff0b4] p-4 text-sm">{message}</p>}
    {loading&&<p role="status">正在定位消息对应记录…</p>}
    {readFailed&&<Card className="space-y-3 p-5"><p className="text-sm">记录可能已处理、被移除或当前账号无权访问。原消息与已保存数据不作改写。</p><Button variant="secondary" disabled={busy||loading} onClick={()=>{setError('');setReadFailed(false);setLoading(true);setRevision(v=>v+1);}}>重新读取当前事项</Button></Card>}
    {value&&!loading&&!readFailed&&<RecordContent key={`${value.row.id}:${value.row.version}`} row={value.row} data={value.data} busy={busy} mutate={mutate} notice={notice} noticeDate={noticeDate}/>}
  </div></main>;
}
function RecordContent({row,data,busy,mutate,notice,noticeDate}:{row:Row;data:Workspace;busy:boolean;mutate:Mutate;notice:Notice;noticeDate?:string}) {
  switch(row.kind){
    case 'TASK':{
      const task=row as Row<Task>;
      return task.data.sourceType==='SELF'&&!task.data.approvedAt&&task.ownerId===data.user.id
        ?<TaskRequestCard initialExpanded row={task} data={data} busy={busy} mutate={mutate}/>
        :<TaskCard initialExpanded row={task} data={data} busy={busy} mutate={mutate}/>;
    }
    case 'IVY':return <IvyCard row={row as Row<Ivy>} data={data} busy={busy} mutate={mutate}/>;
    case 'NOTE':return <NoteCard row={row as Row<Note>} data={data} busy={busy} mutate={mutate}/>;
    case 'MEMBER':{
      const member=row as Row<Member>;
      if(notice){
        const own=member.ownerId===data.user.id;
        const focused={...data,user:{...data.user,isTrainee:own&&data.user.isTrainee},members:[member],ivy:data.ivy.filter(r=>r.ownerId===member.ownerId),notes:data.notes.filter(r=>r.ownerId===member.ownerId)};
        return <div className="space-y-5"><Card className="space-y-3 bg-[#fff8dc] p-5"><h2 className="text-xl font-black">{member.ownerName} · {notice==='ivy-missing'?'艾维利缺交核对':'学习清单待补齐'}</h2><p className="text-sm">提醒日期：{noticeDate??'原消息未提供明确日期'} · 查看周 {data.week}</p>{notice==='ivy-missing'&&<p className="text-sm">历史日报跨日锁定，保留真实缺交事实；可核对历史记录并填写当日日报。</p>}{own&&<Link href={`/ai-center?tab=${notice==='ivy-missing'?'ivy':'notes'}`} className="inline-block text-sm font-bold underline">进入当前周{notice==='ivy-missing'?'艾维利':'学习清单'}</Link>}</Card>{notice==='ivy-missing'?<IvyTab data={focused} busy={busy} mutate={mutate}/>:<NotesTab data={focused} busy={busy} mutate={mutate}/>}</div>;
      }
      if(member.ownerId===data.user.id&&data.user.isTrainee)return <MyMentorsTab data={{...data,members:[member]}} busy={busy} mutate={mutate}/>;
      if(member.data.mentorRequest?.status==='PENDING')return <MentorRequestApproval row={member} data={data} busy={busy} mutate={mutate}/>;
      return <Card className="space-y-4 p-5"><h2 className="text-xl font-black">{member.ownerName} · 导师配置</h2><MentorNames data={data} ai={member.data.aiMentorId} departments={member.data.departmentMentorIds}/>{member.data.mentorRequest&&<RequestResult request={member.data.mentorRequest} data={data}/>}</Card>;
    }
    case 'LINK':return row.canReview&&row.status==='PENDING'
      ?<LinkApproval row={row as Workspace['links'][number]} data={data} busy={busy} mutate={mutate}/>:<RecordOutcome row={row}/>;
    case 'APPEAL':return row.canReview&&row.status==='PENDING'
      ?<AppealApproval row={row as Workspace['appeals'][number]} busy={busy} mutate={mutate}/>:<RecordOutcome row={row}/>;
    default:return <RecordOutcome row={row}/>;
  }
}
function RecordOutcome({row}:{row:Row}) {
  return <Card className="space-y-3 p-5"><h2 className="text-xl font-black">{row.ownerName} · 当前处理结果</h2><p className="text-sm">{row.status==='PENDING'?'当前账号没有此事项的处理权限，可查看当前结果。':'事项状态已更新，可查看保留的结果与说明。'}</p><RecordSnapshot value={row}/></Card>;
}
