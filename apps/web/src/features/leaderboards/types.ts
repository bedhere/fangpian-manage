export type LabelingEntry = {
  traineeId: string; workDate: string; count: number; version: number;
  source: 'MANUAL' | 'API'; note: string; updatedAt: string;
};
export type LabelingDaily = { date: string; rows: { traineeId: string; displayName: string; entry: LabelingEntry | null }[] };
export type LabelingBoard = {
  from: string; to: string; timeZone: string; canManage: boolean; canSync?: boolean;
  summary: { totalCount: number; participants: number; traineeCount: number };
  rows: { traineeId: string; displayName: string; departmentName: string | null; count: number; rank: number | null; reportedDays: number; isSelf: boolean; updatedAt: string | null }[];
};
export type TianjiSyncJob = { id: string; from: string; to: string; status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'; message: string; processed: number; result: { skippedNames?: string[] } | null; updatedAt: string; finishedAt: string | null };
export type TianjiStatus = { authenticated: boolean; configured: boolean; name: string | null; employeeId: number | null; latestJob: TianjiSyncJob | null };
