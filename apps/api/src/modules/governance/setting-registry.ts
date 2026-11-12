export type SettingField = {
  path: string;
  label: string;
  type: 'number' | 'boolean' | 'string' | 'number-array' | 'string-array';
  min?: number;
  max?: number;
};
export type SettingDefinition = { key: string; label: string; group: 'matching' | 'execution' | 'rating' | 'reputation' | 'settlement' | 'analytics' | 'security' | 'intake'; fields: SettingField[] };

const number = (path: string, label: string, min = 0, max?: number): SettingField => ({ path, label, type: 'number', min, max });
const definitions: SettingDefinition[] = [
  { key: 'matching.weights', label: '匹配评分权重', group: 'matching', fields: ['skills','capability','successRate','similarExperience','capacity','reputation'].map((key) => number(key, key, 0, 100)) },
  { key: 'matching.defaults', label: '匹配默认值', group: 'matching', fields: [number('successRate', '默认成功率', 0, 100), number('similarExperience', '默认相似经验', 0, 100)] },
  { key: 'risk.thresholds', label: '项目风险阈值', group: 'execution', fields: [number('yellowGap','黄色偏差',0,100), number('redGap','红色偏差',0,100), number('yellowRiskLevel','黄色风险级别',0), number('redRiskLevel','红色风险级别',0)] },
  { key: 'execution.deadlineReminderDays', label: '截止提醒天数', group: 'execution', fields: [{ path: 'days', label: '提醒天数', type: 'number-array', min: 0 }] },
  { key: 'rating.thresholds', label: '评级阈值', group: 'rating', fields: ['S','A','B','C'].map((key) => number(key, `${key} 级`, 0, 100)) },
  { key: 'rating.weights', label: '评分权重', group: 'rating', fields: ['publisherBusiness','departmentHeadBusiness','aiTechnical','ownerManagerTechnical','projectManagement'].map((key) => number(key, key, 0, 100)) },
  { key: 'rating.projectManagement', label: '项目管理扣分', group: 'rating', fields: ['baseScore','overduePenalty','redSnapshotPenalty','unresolvedRiskPenalty'].map((key) => number(key, key, 0, 100)) },
  { key: 'rating.highValueThreshold', label: '高价值项目阈值', group: 'rating', fields: [number('$', '金额阈值', 0)] },
  { key: 'reputation.eventDeltas', label: '信誉事件分值', group: 'reputation', fields: ['GRADE_S','GRADE_A','ON_TIME','OWNER_REPLACED','PROJECT_FAILED','MALICIOUS_ABANDON'].map((key) => number(key, key, -100, 100)) },
  { key: 'reputation.ownerReplacementRestriction', label: '负责人替换限制', group: 'reputation', fields: [number('days','限制天数',0), { path: 'levels', label: '限制项目等级', type: 'string-array' }] },
  { key: 'feedback.skillVerification', label: '项目技能验证规则', group: 'reputation', fields: [number('minimumContributionPercentage','最低贡献比例',0,100), { path: 'acceptedGrades', label: '可验证评级', type: 'string-array' }] },
  { key: 'feedback.capabilityProgression', label: '能力等级晋级规则', group: 'reputation', fields: [number('L0','L0 门槛',0), number('L1','L1 门槛',0), number('L2','L2 门槛',0), number('L3','L3 门槛',0), number('L4','L4 门槛',0), { path: 'allowAutomaticDemotion', label: '允许自动降级', type: 'boolean' }] },
  { key: 'settlement.lockDay', label: '月结锁定日', group: 'settlement', fields: [number('$', '每月锁定日', 1, 28)] },
  { key: 'analytics.contributionWeights', label: '贡献排行权重', group: 'analytics', fields: ['projectValue','grade','projectLevel','contribution','crossDepartment','onTime','aiEfficiency'].map((key) => number(key, key, 0, 100)) },
  { key: 'security.selfReviewForbidden', label: '禁止自审', group: 'security', fields: [{ path: '$', label: '禁止用户审核自己', type: 'boolean' }] },
  { key: 'intake.manualDiagnosisDefaults', label: '人工诊断默认值', group: 'intake', fields: [number('confidence','置信度',0,100), number('businessValueScore','业务价值',0,100), number('technicalComplexityScore','技术复杂度',0,100), number('urgencyScore','紧急度',0,100), { path: 'aiProjectLevel', label: 'AI 项目等级', type: 'string' }, { path: 'humanProjectLevel', label: '人工项目等级', type: 'string' }, number('aiCapabilityLevel','AI 能力等级',0,4), number('humanCapabilityLevel','人工能力等级',0,4), number('aiEstimatedHours','AI 工时',0), number('humanEstimatedHours','人工工时',0), { path: 'requiredSkills', label: '默认技能', type: 'string-array' }] },
  { key: 'ai.deliveryReviewContext', label: 'AI 交付评审上下文限制', group: 'intake', fields: [number('maxProgressLogs','最大进展数',1,200), number('maxRisks','最大风险数',1,100), number('maxDeliveryVersions','最大交付版本数',1,20), number('maxTextChars','单版本最大文本字符',100,200000)] },
  { key: 'ai.evaluationWorker', label: 'AI 异步评估重试', group: 'intake', fields: [number('attempts','最大尝试次数',1,10), number('backoffMs','重试退避毫秒',100,600000)] },
  { key: 'opportunity.rules', label: '内部机会规则', group: 'intake', fields: [number('maxOpenDays','最长开放天数',1,365), number('maxProposalsPerUser','每人提案上限',1,10)] },
  { key: 'circle.rules', label: '临时圈子规则', group: 'intake', fields: [number('defaultDurationDays','默认持续天数',1,365), number('maxMembers','最大成员数',2,500)] },
  { key: 'buff.rules', label: 'AI Buff 运行规则', group: 'intake', fields: [number('attempts','最大尝试次数',1,10), number('backoffMs','重试退避毫秒',100,600000)] },
  { key: 'buff.costRules', label: 'AI Buff 成本规则', group: 'intake', fields: [number('inputMicrosPer1k','每千输入 Token 微元',0,100000000), number('outputMicrosPer1k','每千输出 Token 微元',0,100000000)] },
  { key: 'network.rules', label: '价值网络查询规则', group: 'analytics', fields: [number('maxRangeDays','最大时间范围天数',1,3650), number('maxNodes','最大节点数',10,10000)] },
];

export function listSettingDefinitions() { return definitions; }
export function getSettingDefinition(key: string) { return definitions.find((item) => item.key === key); }
function atPath(value: unknown, path: string): unknown {
  if (path === '$') return value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return (value as Record<string, unknown>)[path];
}
export function validateRegisteredSetting(key: string, value: unknown) {
  const definition = getSettingDefinition(key);
  if (!definition) throw new Error('UNKNOWN_SETTING');
  for (const field of definition.fields) {
    const candidate = atPath(value, field.path);
    const valid = field.type === 'number'
      ? typeof candidate === 'number' && Number.isFinite(candidate) && (field.min === undefined || candidate >= field.min) && (field.max === undefined || candidate <= field.max)
      : field.type === 'boolean' ? typeof candidate === 'boolean'
      : field.type === 'string' ? typeof candidate === 'string' && candidate.length > 0
      : field.type === 'number-array' ? Array.isArray(candidate) && candidate.every((item) => typeof item === 'number' && (field.min === undefined || item >= field.min))
      : Array.isArray(candidate) && candidate.every((item) => typeof item === 'string' && item.length > 0);
    if (!valid) throw new Error(`INVALID_SETTING_VALUE:${field.path}`);
  }
}
