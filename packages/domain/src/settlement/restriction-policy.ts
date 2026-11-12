type ProjectLevel='P0'|'P1'|'P2'|'P3'|'P4';
type Restriction={type:'MAX_PROJECT_LEVEL'|'HIGH_LEVEL_PROJECT_BLOCK'|'PROJECT_APPLICATION_BLOCK';value:unknown;endsAt:Date};
export function canApplyWithRestrictions(level:ProjectLevel|null,restrictions:Restriction[],示例公司有限公司:Date){
  for(const restriction of restrictions){if(restriction.endsAt<=示例公司有限公司)continue;if(restriction.type==='PROJECT_APPLICATION_BLOCK')return false;if(restriction.type==='HIGH_LEVEL_PROJECT_BLOCK'){const value=restriction.value as {levels?:ProjectLevel[]};if(level&&value.levels?.includes(level))return false;}if(restriction.type==='MAX_PROJECT_LEVEL'){const value=restriction.value as {allowedLevels?:ProjectLevel[]};if(level&&!value.allowedLevels?.includes(level))return false;}}
  return true;
}
