import { Button } from '@fangpian/ui';
import { useRef, useState } from 'react';
import { learningWebsite, learningRichDocument, learningRichText } from '@value-flow/domain/learning-note';
import { blankTask, TaskInputs } from './task-inputs';
import { dateText, errorText, field, iso, localDateTime, type Action, type Mutate, type Note, type Row, type Workspace } from './types';
import { ErrorBox } from './ui';
import { useNoteDraft, type NoteDraftFields } from './use-note-draft';
import { LearningRichEditor } from './learning-rich-editor';

export function NoteEditor({row,data,busy,mutate,onClose}:{row?:Row<Note>;data:Workspace;busy:boolean;mutate:Mutate;onClose:()=>void}) {
  const [initial]=useState<NoteDraftFields>(()=>({week:row?.dateKey??data.week,title:row?.data.title??'',content:row?.data.content??'',businessLink:row?.data.businessLink??'',websites:row?.data.websites??(learningWebsite(row?.data.title??'')?[row!.data.title]:['']),...(row?.data.contentDocument?{contentDocument:row.data.contentDocument}:{}),actions:row?.data.actions.map(a=>({...a,dueAt:localDateTime(a.dueAt)}))??[]}));
  const [value,setValue]=useState(initial);
  const [saving,setSaving]=useState(false);const [error,setError]=useState('');
  const lock=useRef(false);
  const draft=useNoteDraft({ownerId:data.user.id,noteId:row?.id,baseVersion:row?.version,initial,value});
  const disabled=busy||saving;
  const meaningful=[value.title,value.content,value.businessLink,...(value.websites??[]),...value.actions.flatMap(a=>[a.title,a.description,a.acceptanceCriteria,a.dueAt])].some(v=>v.trim());
  function set<K extends keyof NoteDraftFields>(key:K,next:NoteDraftFields[K]){setValue(v=>({...v,[key]:next}));}
  async function save(submit:boolean){
    if(lock.current||disabled)return;
    lock.current=true;setSaving(true);setError('');
    try{
      const actions=value.actions.map(a=>({...a,dueAt:a.dueAt?iso(a.dueAt):''}));
      const websites=(value.websites??[]).map(v=>v.trim()).filter(Boolean).map(v=>{const href=learningWebsite(v);if(submit&&!href)throw new Error('请补全所有网站为有效HTTP或HTTPS链接');return href??v;});
      if(submit&&!websites.length&&!value.title.trim())throw new Error('请至少填写一个主题网站');
      const contentDocument=value.contentDocument?learningRichDocument(value.contentDocument):undefined;
      const content=contentDocument?learningRichText(contentDocument):value.content;
      if(submit&&!content.trim())throw new Error('请填写学习内容');
      const ok=await mutate(row?`/notes/${row.id}`:'/notes',{...value,content,contentDocument,websites,actions,submit,...(row?{version:row.version}:{})},row?'PATCH':'POST');
      if(ok){draft.cloudSaved();onClose();}
      else setError('云端保存未确认，当前输入仍保留。请核对错误后重试；临时备份状态见下方。');
    }catch(reason){setError(errorText(reason));}
    finally{lock.current=false;setSaving(false);}
  }
  function restore(){const saved=draft.recover();if(saved){setValue({...saved,websites:saved.websites??(learningWebsite(saved.title)?[saved.title]:[''])});setError('');}}
  return <form className="space-y-4 rounded-2xl border border-[#ded7c1] bg-[#fffcf2] p-4 sm:p-5" onSubmit={event=>{event.preventDefault();void save(true);}}>
    <h3 className="text-lg font-black">{row?'编辑学习笔记':'新建学习笔记'}</h3>
    <ErrorBox message={error}/>
    {draft.warning&&<p role="alert" className="rounded-xl bg-[#fff1bc] p-3 text-sm">{draft.warning}</p>}
    {draft.recovery&&<div className="space-y-3 rounded-xl bg-[#fff1bc] p-4"><p className="text-sm font-bold">发现浏览器临时内容 · {dateText(draft.recovery.backup.savedAt)}</p><p className="text-xs">备份归属周 {draft.recovery.backup.fields.week}。{draft.recovery.backup.baseVersion!==(row?.version??null)?'云端版本与备份不同，请核对后再恢复和保存。':'恢复不会自动改写云端。'}</p><div className="flex flex-wrap gap-3"><Button type="button" variant="secondary" disabled={disabled} onClick={restore}>恢复临时内容</Button><Button type="button" variant="secondary" disabled={disabled} onClick={draft.discard}>丢弃这份临时备份</Button></div></div>}
    <fieldset className="space-y-4" disabled={disabled}>
      <label className="block text-sm font-bold">归属周（请选择周一）<input required className={field} type="date" value={value.week} onChange={e=>set('week',e.target.value)}/></label>
      <p className="text-xs text-[#756d59]">笔记保存在所选归属周，可在页面顶部切换到对应周继续编辑。</p>
      <div className="space-y-3"><h4 className="text-sm font-bold">主题网站标签</h4>{value.title&&!learningWebsite(value.title)&&<p className="text-xs text-[#756d59]">保留主题：{value.title}</p>}<div className="flex flex-wrap gap-2">{(value.websites??[]).map((website,i)=>{const href=learningWebsite(website);return <div key={i} className="flex max-w-full flex-wrap items-center gap-2 rounded-2xl border border-[#ded7c1] bg-white p-2"><input aria-label={`主题网站${i+1}`} className="min-w-48 flex-1 bg-transparent px-2 py-1 text-sm outline-none" maxLength={2048} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if((value.websites?.length??0)<20)set('websites',[...(value.websites??[]),'']);}}} value={website} placeholder="网站，如 https://example.com" onChange={e=>set('websites',(value.websites??[]).map((v,j)=>j===i?e.target.value:v))}/>{href&&!disabled?<a href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="text-xs font-bold text-[#806015] underline">打开 ↗</a>:<span className="text-xs text-[#9a9384]">网址待补全</span>}<Button type="button" variant="secondary" aria-label={`删除网站${i+1}`} onClick={()=>set('websites',(value.websites??[]).filter((_,j)=>j!==i))}>×</Button></div>;})}</div><Button type="button" variant="secondary" disabled={disabled||(value.websites?.length??0)>=20} onClick={()=>set('websites',[...(value.websites??[]),''])}>＋ 添加网站标签</Button><p className="text-xs text-[#756d59]">最多20个网站，支持HTTP/HTTPS；未写协议的完整域名使用HTTPS打开。</p></div>
      <div className="space-y-2"><h4 className="text-sm font-bold">学习内容</h4><LearningRichEditor document={value.contentDocument} text={value.content} disabled={disabled} onChange={(contentDocument,content)=>setValue(v=>({...v,contentDocument,content}))}/></div>
      <label className="block text-sm font-bold">自己的理解<textarea required maxLength={12000} className={field} value={value.businessLink} onChange={e=>set('businessLink',e.target.value)}/></label>
      <h4 className="font-black">TodoList行动（正式提交至少2条；草稿可暂未填完）</h4>
      {value.actions.map((action,i)=><div className="space-y-3 rounded-xl border border-[#e4ddc8] p-4" key={action.id}><div className="flex justify-between gap-2"><p className="font-bold">行动 {i+1}</p><Button type="button" variant="secondary" onClick={()=>set('actions',value.actions.filter(x=>x.id!==action.id))}>删除行动</Button></div><TaskInputs value={action} difficulty onChange={next=>set('actions',value.actions.map(a=>a.id===action.id?{...next,id:action.id}:a))}/></div>)}
      <Button type="button" variant="secondary" disabled={disabled||value.actions.length>=30} onClick={()=>set('actions',[...value.actions,{...blankTask(),id:crypto.randomUUID()} as Action])}>增加行动建议</Button>
      <p className="text-xs leading-6 text-[#756d59]">已批准行动的原始内容仍受保护。保存草稿不会生成任务或提交考核；正式提交后才进入导师审核。</p>
      <div className="flex flex-wrap gap-3"><Button type="button" variant="secondary" disabled={disabled||!meaningful} onClick={()=>void save(false)}>{saving?'正在保存…':'保存到云端（草稿）'}</Button><Button disabled={disabled||value.actions.length<2}>正式提交笔记与行动建议</Button><Button type="button" variant="secondary" disabled={disabled} onClick={onClose}>关闭编辑</Button></div>
    </fieldset>
    <p role="status" className="text-xs leading-6 text-[#756d59]">{saving?'正在等待云端确认，请勿离开。':draft.dirty?(draft.backupAt?`浏览器临时备份：${dateText(draft.backupAt)}。请点击保存到云端，才能在其他设备继续使用。`:'内容尚未保存到云端，请点击保存按钮。'):'草稿可在补充完整前保存；正式提交仍需满足笔记与行动要求。'}</p>
  </form>;
}
