import { useEffect, useRef, useState } from 'react';
import type { Action } from './types';
import { learningRichDocument, type LearningRichDocument } from '@value-flow/domain/learning-note';

export type NoteDraftFields={week:string;title:string;content:string;businessLink:string;websites?:string[];contentDocument?:LearningRichDocument;actions:Action[]};
type Backup={schema:1;ownerId:string;noteId:string|null;writer:string;baseVersion:number|null;savedAt:string;fields:NoteDraftFields};
type Recovery={key:string;raw:string;backup:Backup};
const bounded=(v:unknown,max:number):v is string=>typeof v==='string'&&v.length<=max;
function validFields(value:unknown):value is NoteDraftFields {
  if(!value||typeof value!=='object')return false;
  const f=value as NoteDraftFields;
  if(f.websites!==undefined&&(!Array.isArray(f.websites)||f.websites.length>20||!f.websites.every(v=>bounded(v,2048))))return false;
  if(f.contentDocument!==undefined){try{learningRichDocument(f.contentDocument);}catch{return false;}}
  return bounded(f.week,100)&&bounded(f.title,200)&&bounded(f.content,30000)&&bounded(f.businessLink,12000)&&Array.isArray(f.actions)&&f.actions.length<=30&&f.actions.every(a=>a&&bounded(a.id,50)&&bounded(a.title,200)&&bounded(a.description,12000)&&bounded(a.acceptanceCriteria,12000)&&bounded(a.dueAt,40)&&['P0','P1','P2','P3'].includes(a.priority)&&['S','A','B','C'].includes(a.selfDifficulty));
}
function encode(backup:Backup){const raw=JSON.stringify(backup);if(raw.length>1200000||!validFields(backup.fields))throw new Error('Invalid local draft');return raw;}
function parse(raw:string,ownerId:string,noteId:string|null):Backup|null {
  if(raw.length>1200000)return null;
  const b=JSON.parse(raw) as Backup;
  return b?.schema===1&&b.ownerId===ownerId&&b.noteId===noteId&&bounded(b.writer,50)&&typeof b.savedAt==='string'&&Number.isFinite(Date.parse(b.savedAt))&&(b.baseVersion===null||Number.isInteger(b.baseVersion)&&b.baseVersion>0)&&validFields(b.fields)?b:null;
}

/** Local recovery is isolated by account, note/week, and editor. It never sends an API request. */
export function useNoteDraft({ownerId,noteId,baseVersion,initial,value}:{ownerId:string;noteId?:string;baseVersion?:number;initial:NoteDraftFields;value:NoteDraftFields}) {
  const [writer]=useState(()=>crypto.randomUUID());
  const prefix=`fangpian:note-draft:v1:${ownerId}:${noteId??`new:${initial.week}`}:`;
  const ownKey=prefix+writer;
  const [loaded,setLoaded]=useState(false);
  const [recovery,setRecovery]=useState<Recovery|null>(null);
  const [warning,setWarning]=useState('');
  const [backupAt,setBackupAt]=useState('');
  const pending=useRef<Backup|null>(null);const saved=useRef(false);const restored=useRef<Recovery|null>(null);
  const serialized=JSON.stringify(value),dirty=serialized!==JSON.stringify(initial);
  useEffect(()=>{
    const frame=window.requestAnimationFrame(()=>{
      try{
        let latest:Recovery|null=null;
        for(let i=0;i<localStorage.length;i++){
          const key=localStorage.key(i);if(!key?.startsWith(prefix)||key===ownKey)continue;
          const raw=localStorage.getItem(key);if(!raw)continue;
          try{const backup=parse(raw,ownerId,noteId??null);if(backup&&(!latest||backup.savedAt>latest.backup.savedAt))latest={key,raw,backup};}catch{/* Leave incompatible buffers untouched. */}
        }
        setRecovery(latest);
      }catch{setWarning('浏览器临时备份不可用，请及时点击保存到云端。');}
      setLoaded(true);
    });
    return()=>window.cancelAnimationFrame(frame);
  },[prefix,ownKey,ownerId,noteId]);
  useEffect(()=>{
    if(!loaded||saved.current)return;
    if(!dirty){pending.current=null;try{localStorage.removeItem(ownKey);}catch{/* Cloud save remains available. */}return;}
    const backup:Backup={schema:1,ownerId,noteId:noteId??null,writer,baseVersion:baseVersion??null,savedAt:new Date().toISOString(),fields:JSON.parse(serialized) as NoteDraftFields};
    pending.current=backup;
    const timer=window.setTimeout(()=>{
      if(saved.current)return;
      try{localStorage.setItem(ownKey,encode(backup));setBackupAt(backup.savedAt);setWarning('');}
      catch{setWarning('浏览器临时备份未成功，请点击保存到云端；当前输入仍保留。');}
    },600);
    return()=>window.clearTimeout(timer);
  },[loaded,dirty,serialized,ownKey,ownerId,noteId,writer,baseVersion]);
  useEffect(()=>{
    function flush(){if(!saved.current&&pending.current){try{localStorage.setItem(ownKey,encode(pending.current));}catch{/* Never report a failed local write as a cloud save. */}}}
    window.addEventListener('beforeunload',flush);
    return()=>{window.removeEventListener('beforeunload',flush);flush();};
  },[ownKey]);
  function recover():NoteDraftFields|undefined {
    if(!recovery)return;
    try{
      if(localStorage.getItem(recovery.key)!==recovery.raw){setWarning('临时备份已在其他页面更新，请重新打开编辑区核对。');return;}
    }catch{setWarning('暂时无法读取临时备份，请保留当前输入并手动保存到云端。');return;}
    if((dirty||recovery.backup.baseVersion!==(baseVersion??null))&&!window.confirm('恢复临时内容会替换当前编辑区内容；云端数据不会自动改写。确认恢复并核对后手动保存？'))return;
    restored.current=recovery;setRecovery(null);return recovery.backup.fields;
  }
  function discard(){
    if(!recovery||!window.confirm('确认丢弃这份浏览器临时备份？云端笔记与当前编辑内容不受影响。'))return;
    try{if(localStorage.getItem(recovery.key)===recovery.raw){localStorage.removeItem(recovery.key);setRecovery(null);}else setWarning('备份已更新，未删除，请重新打开编辑区核对。');}
    catch{setWarning('无法删除临时备份，云端保存功能仍可使用。');}
  }
  function cloudSaved(){
    saved.current=true;pending.current=null;
    try{
      const raw=localStorage.getItem(ownKey);
      if(raw){const b=parse(raw,ownerId,noteId??null);if(b?.writer===writer)localStorage.removeItem(ownKey);}
      const old=restored.current;
      if(old&&localStorage.getItem(old.key)===old.raw)localStorage.removeItem(old.key);
    }catch{/* A retained recovery 示例品牌 is preferable to deleting newer content. */}
  }
  return {dirty,recovery,warning,backupAt,recover,discard,cloudSaved};
}
