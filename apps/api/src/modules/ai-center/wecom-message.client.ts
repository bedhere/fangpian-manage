import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {selectIvyRecipient,selectIvyAuthorizedSelf,type IvyMessageTarget,type WecomSession} from './ivy-wecom-message.js';
const execute=promisify(execFile);
export class WecomMessageFailure extends Error{
 constructor(public readonly code:string,message:string,public readonly uncertain=false,public readonly pause=false){super(message);}
}
type Runner=(args:string[])=>Promise<string>;
export class WecomMessageClient{
 private readonly runner:Runner;
 constructor(runner?:Runner){this.runner=runner??(async args=>{
  try{return(await execute(process.env.WECOM_CLI_BIN??'/usr/local/bin/wecom-cli',args,{timeout:25000,maxBuffer:2*1024*1024,encoding:'utf8',env:{...process.env,WECOM_CLI_CONFIG_DIR:process.env.WECOM_CLI_CONFIG_DIR??'/home/node/.config/wecom-cli'}})).stdout;}
  catch(error){const stdout=(error as {stdout?:unknown}).stdout;if(typeof stdout==='string'&&stdout.trim())return stdout;throw error;}
 });}
 private async call(args:string[],sending=false,identity=false):Promise<Record<string,any>>{
  let raw:string;try{raw=await this.runner(args);}catch{throw new WecomMessageFailure('NETWORK_UNAVAILABLE',sending?'发送结果未确认，请核对企微后再处理':'无法读取企微会话，请稍后核对连接',sending,true);}
  let result:Record<string,any>;try{result=JSON.parse(raw);}catch{throw new WecomMessageFailure('INVALID_RESPONSE','企微返回无法确认，已停止本次发送',sending,true);}
  if(!result||typeof result!=='object')throw new WecomMessageFailure('INVALID_RESPONSE','企微返回无法确认',sending,true);
  let accepted=false;
  for(let level=0;level<4;level++){
  const code=result.errcode??result.error?.code;
  if(code!==undefined&&Number(code)!==0){
   if([850003,850002,853004].includes(Number(code)))throw new WecomMessageFailure(String(code),'企微消息授权已过期或未开放，请在原机器人中续期',false,true);
   if(Number(code)===429||/rate.limit|too frequent|frequency|频率|限流/i.test(String(result.errmsg??'')))throw new WecomMessageFailure('RATE_LIMITED','企微请求频率受限，已暂停消息发送',false,true);
   throw new WecomMessageFailure(String(code??'INVALID_RESPONSE'),code===undefined?'企微返回无法确认':`企微拒绝本次操作（错误码${String(code).replace(/[^0-9-]/g,'')}）`,sending&&code===undefined,code===undefined);
  }
  // The message CLI can return the schema-defined business receipt without
  // the transport errcode envelope. Only the explicit boolean is authoritative.
  if(sending&&'success'in result){
   if(typeof result.success!=='boolean')throw new WecomMessageFailure('INVALID_RESPONSE','企微发送结果格式无法确认',true,true);
   if(!result.success)throw new WecomMessageFailure('SEND_NOT_ACCEPTED','企微未接受本次消息发送，已暂停推送',false,true);
   accepted=true;
  }
  if(Number(code)===0)accepted=true;
  if(identity&&typeof result.extra_identity_context==='string')accepted=true;
  if(!sending&&!identity&&Array.isArray(result.sessions)&&result.sessions.every((s:unknown)=>!!s&&typeof s==='object'&&typeof (s as any).chat_id==='string'&&typeof (s as any).chat_name==='string'&&['single','group'].includes((s as any).chat_type)))accepted=true;
  const wrapped=result.results_json??(result.data&&typeof result.data==='object'&&('errcode'in result.data||'error'in result.data||(sending&&'success'in result.data)||(!sending&&!identity&&'sessions'in result.data))?result.data:undefined);
  if(wrapped!==undefined&&wrapped!==null&&wrapped!==''){
   let inner:unknown;try{inner=typeof wrapped==='string'?JSON.parse(wrapped):wrapped;}catch{throw new WecomMessageFailure('INVALID_RESPONSE','企微业务响应无法确认',sending,true);}
   if(!inner||typeof inner!=='object'||Array.isArray(inner))throw new WecomMessageFailure('INVALID_RESPONSE','企微业务响应无法确认',sending,true);
   result=inner as Record<string,any>;continue;
  }
  if(!accepted)throw new WecomMessageFailure('INVALID_RESPONSE','企微操作结果无法确认',sending,true);
  return result;
  }
  throw new WecomMessageFailure('INVALID_RESPONSE','企微响应层级异常，已停止发送',sending,true);
 }
 async send(target:IvyMessageTarget,content:string,beforeCall:()=>Promise<void>){
  if(Buffer.byteLength(content,'utf8')>20000)throw new WecomMessageFailure('TOO_LONG','日报过长，已保存但未推送；请精简后重新保存');
  await beforeCall();
  const identity=await this.call(['identity','whoami'],false,true);
  let recipient=selectIvyAuthorizedSelf(identity,target);
  if(!recipient){
   await beforeCall();
   const result=await this.call(['message','aibot','sessions','list']);
   const sessions=result.sessions??result.data?.sessions;
   if(!Array.isArray(sessions))throw new WecomMessageFailure('INVALID_SESSIONS','无法确认可发送会话，已停止发送',false,true);
   recipient=selectIvyRecipient(sessions as WecomSession[],target);
  }
  if(!recipient)throw new WecomMessageFailure('TARGET_UNAVAILABLE','指定接收人未出现在可发送单聊中，或存在同名会话；请先与原机器人对话',false,true);
  await beforeCall();
  await this.call(['message','aibot','send','--json',JSON.stringify({chat_id:recipient.chat_id,msg_type:'markdown',markdown:{content}})],true);
 }
}
