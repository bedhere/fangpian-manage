import { Badge, Button, Card } from '@fangpian/ui';
import { useEffect, useRef, useState } from 'react';
import { dateText, errorText, field, request, write, type GrowthTarget } from './types';
import { Empty, ErrorBox } from './ui';

/** Independent reads/writes 示例品牌 the existing growth editor mounted and its drafts intact. */
export function GrowthRatingReviews({ userId, personId }: {userId:string;personId:string}) {
  const [rows,setRows]=useState<GrowthTarget[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();let active=true;
    void request<GrowthTarget[]>('/growth-plans',controller.signal).then(result=>{if(active)setRows(result);})
      .catch(reason=>{if(active)setError(errorText(reason));}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;controller.abort();};
  },[revision]);
  const visible=rows.filter(row=>!personId||row.ownerId===personId);
  return <section className="space-y-4" aria-label="已发布周评级复核">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-black">已发布周评级与复核</h3><Button variant="secondary" disabled={loading} onClick={()=>{setLoading(true);setError('');setRevision(v=>v+1);}}>刷新已发布评级</Button></div>
    <p className="text-sm leading-6 text-[#756d59]">最终综合评级采用 S / A+ / A / A- / B / C 六档。本人可对已发布结果申请复核，由另一位有权限的导师或主管处理；申请不会改写当前评级。</p>
    <ErrorBox message={error}/>{loading&&<p role="status" className="text-sm">正在读取已发布周评级…</p>}
    {!loading&&!error&&!visible.length&&<Empty>当前成员暂无可见的已发布周评级</Empty>}
    {!loading&&visible.map(row=><PublishedRating key={`${row.id}:${row.version}`} row={row} userId={userId}/>)}
  </section>;
}
function PublishedRating({row,userId}:{row:GrowthTarget;userId:string}) {
  const [reason,setReason]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [saved,setSaved]=useState(false);
  const active=useRef(true);const writing=useRef(false);
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  async function appeal(){
    if(writing.current||!reason.trim())return;writing.current=true;setBusy(true);setError('');
    try{await write(`/growth-plans/${row.id}/appeal`,{version:row.version,reason});if(active.current){setSaved(true);setReason('');}}
    catch(error){if(active.current)setError(errorText(error));}
    finally{writing.current=false;if(active.current)setBusy(false);}
  }
  return <Card className="space-y-4 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-lg font-black">{row.ownerName} · {row.data.periodStart} 至 {row.data.periodEnd}</h4><p className="mt-2 text-xs text-[#756d59]">已发布 · v{row.version} · 最近更新 {dateText(row.updatedAt)}</p></div><Badge>最终评级 {row.data.rating??'尚未评定'}</Badge></div><p className="whitespace-pre-wrap break-words text-sm leading-7">{row.data.archiveComment||'暂无附加评价依据，可在成长计划档案中查看完整评价。'}</p><ErrorBox message={error}/>{saved&&<p role="status" className="rounded-xl bg-[#fff5cc] p-3 text-sm font-bold">复核申请已提交，可在待审批页查看进展。</p>}{row.ownerId===userId&&!saved&&<form className="space-y-3" onSubmit={event=>{event.preventDefault();void appeal();}}><label className="block text-sm font-bold">申请复核：具体事实、争议及期望核对内容<textarea required minLength={2} maxLength={2000} className={field} value={reason} onChange={event=>setReason(event.target.value)}/></label><Button disabled={busy||reason.trim().length<2}>提交最终评级复核申请</Button></form>}</Card>;
}
