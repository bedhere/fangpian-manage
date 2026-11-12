type Destination = {entityType:string|null;entityId:string|null;data?:unknown;title?:string;body?:string};
/** Only fixed internal destinations; notification content cannot supply a redirect URL. */
export function notificationHref(item:Destination):string|null {
  if(!item.entityType||!item.entityId)return null;
  const id=encodeURIComponent(item.entityId);
  const data=item.data&&typeof item.data==='object'&&!Array.isArray(item.data)?item.data as Record<string,unknown>:{};
  const project=typeof data.projectId==='string'&&data.projectId?`/projects/${encodeURIComponent(data.projectId)}`:'/projects';
  switch(item.entityType){
    case 'AI_CENTER':{
      // Legacy missing-item notices reference the member, not an existing diary/note.
      const notice=item.title==='艾维利缺交提醒'?'ivy-missing':item.title==='本周学习清单待补齐'?'learning-missing':null;
      if(!notice)return `/ai-center/records/${id}`;
      const date=(notice==='ivy-missing'?/请核对(\d{4}-\d{2}-\d{2})的缺交情况/:/(\d{4}-\d{2}-\d{2})周至少提交/).exec(item.body??'')?.[1];
      return `/ai-center/records/${id}?notice=${notice}${date?`&date=${date}`:''}`;
    }
    case 'TEAM_TASK':return '/tasks';
    case 'Project':return `/projects/${id}`;
    case 'BusinessRequest':return `/requests/${id}`;
    case 'ProjectDelivery':case 'ProjectFeedback':case 'ProjectMember':case 'ProjectRating':return project;
    case 'KnowledgeAsset':return '/knowledge';
    case 'Circle':return '/circles';
    case 'Opportunity':return '/opportunities';
    case 'AIBuff':return '/buffs';
    case 'SettlementBatch':case 'ContributionDispute':case 'ProjectContribution':return '/settlements';
    case 'BonusLedger':return '/bonuses';
    default:return null;
  }
}
