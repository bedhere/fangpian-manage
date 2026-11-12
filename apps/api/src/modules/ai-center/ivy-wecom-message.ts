import { createHash } from 'node:crypto';
import type { IvyData } from './ai-center.types.js';
import type { IvyTaskEntry } from './ai-center-ivy-task-projection.js';
export const ivyMessageHash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export type IvyMessageTarget={targetName:string;targetAliases:string[];chatType:string;testMode:boolean};
export const ivyRoutingHash=(c:IvyMessageTarget)=>ivyMessageHash({name:c.targetName,aliases:[...c.targetAliases].sort(),chatType:c.chatType,testMode:c.testMode});
export function ivyHasMentorApproval(row:{status:string;ownerId:string|null;data:unknown}){
 const data=row.data as Partial<IvyData>|null;
 const review=data&&typeof data==='object'?data.review:undefined;
 return row.status==='REVIEWED'&&!!row.ownerId&&!!review&&['S','A','B','C'].includes(review.grade)&&typeof review.reviewerId==='string'&&!!review.reviewerId&&review.reviewerId!==row.ownerId&&typeof review.at==='string'&&Number.isFinite(Date.parse(review.at));
}
const literal=(v:string)=>v.replace(/\r/g,'').replace(/[\\`*_\[\]()<>#|]/g,'\\$&').replace(/@/g,'@\u200b');
const symbol=(status:string)=>status==='DONE'?'✅':status==='DOING'?'🚶':'❌';
export function formatIvyMessage(input:{recordId:string;recordVersion:number;dateKey:string;ownerName:string;savedAt:string;data:IvyData;tasks:IvyTaskEntry[];target:IvyMessageTarget}){
 const lines=[`### 艾维利日报 · ${literal(input.ownerName).replace(/\n/g,' ')}`,`日期：${input.dateKey}（北京时间）`];
 lines.push('','**今日艾维利**');
 let n=0;
 for(const task of input.tasks){lines.push(`${++n}. ${symbol(task.status)} ${literal(task.title)}〔关联任务 · ${task.priority} · 进度${task.progress}%${task.status==='DONE'?' · 导师已验收':task.taskStatus==='SUBMITTED'?' · 待导师验收':''}〕`);}
 for(const entry of input.data.today){lines.push(`${++n}. ${symbol(entry.status)} ${literal(entry.text).replace(/\n/g,'\n   ')}`);if(entry.note)lines.push(`   说明：${literal(entry.note).replace(/\n/g,'\n   ')}`);}
 if(!n)lines.push('暂无今日事项');
 lines.push('','**示例公司有限公司艾维利**');
 for(const [index,entry]of input.data.tomorrow.entries()){lines.push(`${index+1}. ${symbol(entry.status)} ${literal(entry.text).replace(/\n/g,'\n   ')}`);if(entry.note)lines.push(`   说明：${literal(entry.note).replace(/\n/g,'\n   ')}`);}
 if(!input.data.tomorrow.length)lines.push('暂无示例公司有限公司计划');
 const platformOrigin=(process.env.WEB_PUBLIC_ORIGIN||process.env.WEB_ORIGIN?.split(',')[0]||'https://app.example.invalid').replace(/\/+$/,'');
 lines.push('',`[打开平台查看日报](${platformOrigin}/ai-center/records/${encodeURIComponent(input.recordId)})`);
 const hash=ivyMessageHash(lines.join('\n'));
 lines.push(`审核版本：${input.recordVersion} · ${new Date(input.savedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}`);
 const content=lines.join('\n');
 return {content,contentHash:hash,tooLong:Buffer.byteLength(content,'utf8')>20000};
}
export type WecomSession={chat_id:string;chat_name:string;chat_type:string;last_msg_time?:string};
const normalize=(s:string)=>s.normalize('NFKC').trim();
export function selectIvyRecipient(sessions:WecomSession[],target:IvyMessageTarget){
 const names=new Set([target.targetName,...target.targetAliases].map(normalize));
 const matches=sessions.filter(s=>s.chat_type===target.chatType&&typeof s.chat_id==='string'&&s.chat_id.length>0&&typeof s.chat_name==='string'&&names.has(normalize(s.chat_name)));
 const unique=[...new Map(matches.map(s=>[s.chat_id,s])).values()];
 return unique.length===1?unique[0]:null;
}
/** Parse only the explicit authorized-human block returned by identity whoami.
 * Never substitute the robot ID, infer a contact ID or execute context text. */
export function selectIvyAuthorizedSelf(result:Record<string,unknown>,target:IvyMessageTarget){
 if(target.chatType!=='single'||typeof result.extra_identity_context!=='string')return null;
 const context=result.extra_identity_context;
 const marker='授权真人用户身份：';
 if(context.split(marker).length!==2)return null;
 const block=context.split(marker)[1].trim().split(/\n\s*\n/)[0];
 const name=/^名字[：:][ \t]*([^\r\n]+)$/m.exec(block)?.[1].trim();
 const id=/^ID[：:][ \t]*([^\r\n]+)$/m.exec(block)?.[1].trim();
 if(!name||!id||id.length>200||/[\s<>]/.test(id))return null;
 const names=new Set([target.targetName,...target.targetAliases].map(normalize));
 return names.has(normalize(name))?{chat_id:id,chat_name:name,chat_type:'single'}:null;
}
