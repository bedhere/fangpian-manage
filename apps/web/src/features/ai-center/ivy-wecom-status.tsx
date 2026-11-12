import type {Workspace} from './types';
export function IvyWecomStatus({data,recordId}:{data:Workspace;recordId?:string}){
 const channel=data.ivyWecom;if(!channel?.enabled)return null;
 const delivery=channel.deliveries.find(d=>d.recordId===recordId);
 const labels:Record<string,string>={PENDING:'消息待发送',SENDING:'消息发送中',SENT:'消息已发送',FAILED:'消息未发送成功，日报已保存',UNKNOWN:'发送结果待核对，日报已保存',SUPERSEDED:'已由更新版本替代'};
 return <aside className="space-y-1 rounded-xl border border-[#e7dcae] bg-[#fff9e8] p-3 text-xs text-[#756d59]" aria-label="企微日报通知">
  <p className="font-bold">企微{channel.testMode?'测试':''}接收位置：{channel.targetName}</p>
  <p>{delivery?labels[delivery.status]??'消息状态待核对':'保存后先待导师审核；导师审核并完成评级后，自动发送今日、示例公司有限公司事项和关联任务到指定群。历史日报不自动补发。'}</p>
  {channel.pauseReason&&<p>消息通道已暂停，待管理员恢复授权或核对连接；不影响继续保存日报。</p>}
  {delivery?.errorMessage&&<p>{delivery.errorMessage}</p>}
 </aside>;
}
