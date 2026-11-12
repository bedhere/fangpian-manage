export type ProjectSummary = {
  id: string;
  title: string;
  status: string;
  projectLevel: string | null;
  updatedAt: string;
  publisher: { displayName: string };
  publisherDepartment: { name: string };
  owner: { displayName: string } | null;
};

export type ProjectDetail = {
  id: string;
  title: string;
  description: string;
  businessProblem: string;
  expectedResult: string;
  acceptanceCriteria: string;
  status: string;
  version: number;
  projectLevel: string | null;
  requiredCapabilityLevel: string | null;
  estimatedHours: string | null;
  approvedHours: string | null;
  publisher: { displayName: string };
  publisherDepartment: { name: string };
  owner: { displayName: string } | null;
  approvals: Array<{ id?: string; stage: string; decision: string; comment?: string | null; createdAt?: string; reviewer?: { displayName: string } }>;
  aiAssessments: Array<{ id?: string; output?: unknown; confidence?: string | null }>;
  allowedActions: string[];
};

export const projectStatusLabels: Record<string, string> = {
  DRAFT: '草稿', HUMAN_REQUIRED: '待业务审核', DEPARTMENT_REVIEW: '业务审核', TECH_REVIEW: '技术审核',
  APPROVED: '已批准', PUBLISHED: '已发布', APPLICATION_OPEN: '开放申请', OWNER_ASSIGNED: '已定负责人',
  PLANNING: '规划中', IN_PROGRESS: '执行中', AT_RISK: '有风险', DELIVERY_SUBMITTED: '待验收',
  SETTLED: '已结算', REJECTED: '已驳回', CANCELLED: '已取消',
  AI_TRIAGE: 'AI 诊断中', AI_EXECUTABLE: '可由 AI 执行', AI_WORKSPACE: 'AI 工作空间', AI_COMPLETED: 'AI 已完成',
  AI_DELIVERY_REVIEW: 'AI 交付评审', BUSINESS_ACCEPTANCE: '业务验收', FINAL_RATING: '待评级',
  EXECUTIVE_CONFIRMATION: '待老板确认', CONTRIBUTION_CONFIRMATION: '贡献确认', SETTLEMENT_PENDING: '待结算',
  FAILED: '已失败', OWNER_REPLACED: '负责人已更换',
};
