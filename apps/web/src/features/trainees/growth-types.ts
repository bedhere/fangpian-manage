export type GrowthRating = 'S' | 'A+' | 'A' | 'A-' | 'B' | 'C';
export type GrowthFields = {
  rating: GrowthRating | null; departmentText: string; workResults: string; strengths: string;
  shortfalls: string; growthAdvice: string; nextAssessment: string; archiveComment: string;
  overrideReason?: string;
};
export type GrowthPlan = {
  id: string; traineeId: string; traineeName: string; periodStart: string; periodEnd: string;
  growthAdvice: string; status: 'DRAFT' | 'PUBLISHED'; publishedAt: string | null; canEdit: boolean;
} & Partial<Omit<GrowthFields, 'growthAdvice'> & {
  version: number; createdAt: string; updatedAt: string; previousRating: string | null; previousPeriodStart: string | null;
  quantitativeSuggestion: string | null; quantitativeTotal: number | null; quantitativeStale?:boolean;
  sources: { id: string; filename: string; status: 'READY' | 'ANALYZED' | 'FAILED'; error: string | null; createdAt: string }[];
  history: { version: number; editorName: string; createdAt: string }[];
}>;
export type GrowthWorkspaceData = {
  selfOnly: boolean;
  people: { userId: string; displayName: string; mentorName: string | null; mentorManagerName: string | null; canEdit: boolean; isSelf: boolean }[];
  plans: GrowthPlan[];
};
export const growthFields = [
  ['departmentText', '对接部门'], ['workResults', '本周工作与成果'], ['strengths', '优势表现'],
  ['shortfalls', '存在不足'], ['growthAdvice', '成长建议'], ['nextAssessment', '下阶段重点考核'], ['archiveComment', '档案评语'],
] as const;
export function planFields(plan?: GrowthPlan): GrowthFields {
  return { rating: plan?.rating ?? null, departmentText: plan?.departmentText ?? '', workResults: plan?.workResults ?? '', strengths: plan?.strengths ?? '', shortfalls: plan?.shortfalls ?? '', growthAdvice: plan?.growthAdvice ?? '', nextAssessment: plan?.nextAssessment ?? '', archiveComment: plan?.archiveComment ?? '' };
}
