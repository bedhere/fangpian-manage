/** Strip only known machine-generated scoring paragraphs from published prose.
 * Original evaluations and stored mentor evidence remain unchanged.
 */
export function growthPublicText(value:string,internalPending:readonly string[]=[]):string {
  const pending=new Set(internalPending.filter(line=>typeof line==='string'));
  return value.split('\n').filter(line=>!pending.has(line.trim())).join('\n')
    .replace(/系统事实汇总，规则\d{4}-\d{2}-\d{2}-v\d+。/g,'')
    .replace(/任务交付(?:待核定|[\d.]+)（60%）；艾维利(?:待核定|[\d.]+)（25%）；学习计划(?:待核定|[\d.]+)（15%）。/g,'')
    .replace(/完整总分：(待核定|[\d.]+)；建议评级：(待人工结合事实确认|S|A\+|A-|A|B|C)。最终评级由导师确认，偏离量化建议须说明依据。/g,'')
    .replace(/D=Σ\(确认难度权重×[^\n。]*。(?:无本周应交任务，不适用。)?/g,'')
    .replace(/I=应提交日人工评分之和\/[^\n。]*。当天及未来日期不按缺交计分；休息、批准豁免和入驻前日期不入分母。/g,'')
    .replace(/L=原周计入笔记计划质量分之和\/[^\n。]*。及时首交后的修订保留原周事实；跨周首次补交须明确复核才调整原周缺交，行动交付另计入D。(?:本周已豁免且无正式笔记，不适用。)?/g,'')
    .replace(/，任务分\d+(?:\.\d+)?(?=；|$)/gm,'')
    .replace(/\n{3,}/g,'\n\n').trim();
}

export function growthPublicAppeal<T>(value:T):T {
  const data=value as Record<string,unknown>;
  if(!data||data.targetKind!=='GROWTH')return value;
  const snapshot=data.targetSnapshot as {data?:Record<string,unknown>}|undefined;
  if(typeof snapshot?.data?.archiveComment!=='string')return value;
  return {...data,targetSnapshot:{...snapshot,data:{...snapshot.data,archiveComment:growthPublicText(snapshot.data.archiveComment)}}} as T;
}
