export type Mentor = { id: string; displayName: string; departmentName: string | null };
export type RegistrationOptions = { registrationAvailable: boolean; mentors: Mentor[] };
export type SubmissionStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
export type TraineePerson = {
  userId: string; displayName: string; username: string | null;
  mentorId: string | null; mentorName: string | null; mentorManagerName: string | null;
  isSelf: boolean; canReview: boolean;
  counts: { total: number; pending: number; approved: number; rejected: number };
};
export type Submission = {
  id: string; traineeId: string; traineeName: string; mentorId: string | null; mentorName: string | null;
  departmentId: string; departmentName: string; workDate: string; title: string; problem: string; solution: string;
  expectedValue: string | null; status: SubmissionStatus; version: number; createdAt: string; updatedAt: string;
  canEdit: boolean; canReview: boolean; reviewComment: string | null; reviewerName: string | null; reviewedAt: string | null;
  history: { id: string; decision: 'APPROVED' | 'REJECTED'; comment: string | null; reviewerName: string; reviewedAt: string; version: number }[];
};
export type TraineeWorkspace = {
  from: string; to: string; canSubmit: boolean; canManageMentors: boolean; selfProfile: TraineePerson | null;
  trainees: TraineePerson[]; submissions: Submission[]; departments: { id: string; name: string }[]; mentors: Mentor[];
};
export type SubmissionInput = { title: string; departmentId: string; workDate: string; problem: string; solution: string; expectedValue: string };
export const statusLabels: Record<SubmissionStatus, string> = { DRAFT: '草稿', SUBMITTED: '待审核', APPROVED: '已通过', REJECTED: '未通过' };
export const fieldClass = 'mt-2 min-h-12 w-full min-w-0 rounded-2xl border border-black/15 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-[#b18b0e] focus:ring-4 focus:ring-[#ffd85f]/35 disabled:opacity-60';
export function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '操作失败，请稍后重试';
  return typeof error === 'object' && error && 'status' in error && error.status === 409
    ? `${message}。请刷新工作区后核对最新状态，再重试。` : message;
}
export function jsonRequest(method: string, body: unknown) {
  return { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
