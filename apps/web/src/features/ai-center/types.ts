import { apiClient } from '@/lib/api';
import type { LearningRichDocument } from '@value-flow/domain/learning-note';
export type Grade = 'S' | 'A' | 'B' | 'C';
export type Priority = 'P0' | 'P1' | 'P2' | 'P3';
export type Review = {
    grade: Grade;
    comment: string;
    reviewerId: string;
    reviewerName: string;
    reviewerRole: string;
    at: string;
    reason?: string;
};
export type Row<T = Record<string, unknown>> = {
    id: string;
    kind: string;
    ownerId: string | null;
    ownerName: string;
    dateKey: string;
    status: string;
    version: number;
    data: T;
    createdAt: string;
    updatedAt: string;
    canEdit: boolean;
    canReview: boolean;
};
export type Person = {
    id: string;
    name: string;
    departmentId: string | null;
    departmentName: string | null;
    active: boolean;
    employee: boolean;
    roles: string[];
};
export type MentorRequest={id:string;status:'PENDING'|'APPROVED'|'REJECTED'|'CANCELLED'|'SUPERSEDED';aiMentorId:string;departmentMentorIds:string[];comment:string;submittedBy:string;submittedAt:string;base:{aiMentorId:string|null;departmentMentorIds:string[];active:boolean};reviewerId?:string;reviewerName?:string;reviewedAt?:string;decisionComment?:string};
export type Member = {
    mentorRequest?:MentorRequest;

    active: boolean;
    sinceDate: string;
    aiMentorId: string | null;
    departmentMentorIds: string[];
    legacyMentorId?: string | null;
};
export type Task = {
    title: string;
    description: string;
    acceptanceCriteria: string;
    priority: Priority;
    sourceType: 'AI' | 'IVY' | 'LEARNING' | 'SELF';
    proposalFileIds?:string[];
    proposedAt?:string;
    approvedAt?:string;
    sourceRecordId?: string;
    sourceEntryId?: string;
    assigneeId: string | null;
    targetUserId: string | null;
    selfDifficulty: Grade | null;
    confirmedDifficulty: Grade | null;
    dueAt: string;
    approvedBy?: string;
    progress: number;
    submission?: string;
    submittedAt?: string;
    review?: Review;
    completionRatio?: number;
    decisionComment?: string;
    evidence?: {
        recordId: string;
        entryId: string;
        text: string;
    }[];
};
export type Entry = {
    id: string;
    text: string;
    status: 'DONE' | 'DOING' | 'NOT_DONE';
    note?: string;
};
export type Ivy = {
    today: Entry[];
    tomorrow: Entry[];
    review?: Review;
};
export type IvyTaskEntry = { taskId:string;title:string;status:'DONE'|'DOING'|'NOT_DONE';taskStatus:string;priority:Priority;progress:number;dueAt:string|null };
export type IvyTaskDay = { ownerId:string;ownerName:string;dateKey:string;entries:IvyTaskEntry[] };
export type Action = {
    id: string;
    title: string;
    description: string;
    acceptanceCriteria: string;
    priority: Priority;
    dueAt: string;
    selfDifficulty: Grade;
};
export type Note = {
    websites?:string[];
    contentDocument?:LearningRichDocument;
    lateReview?:{countInOriginalWeek:boolean;reviewerId:string;reviewerName:string;at:string;reason:string};
    title: string;
    content: string;
    businessLink: string;
    actions: Action[];
    review?: Review;
    firstSubmittedAt?: string;
    submittedAt?: string;
    decisionComment?: string;
};
export type Calendar = {
    confirmed: boolean;
    effectiveFrom: string;
    weekdays: number[];
    workStart: string;
    workEnd: string;
    breakStart: string;
    breakEnd: string;
};
export type Workspace = {
    serverDate: string;
    week: string;
    aiDepartmentId: string;
    user: {
        id: string;
        name: string;
        isManager: boolean;
        canApproveMentors:boolean;
        isTrainee: boolean;
        isAiStaff: boolean;
        isMentor: boolean;
    };
    mentorApprover:{id:string;name:string;available:boolean};
    people: Person[];
    members: Row<Member>[];
    taskRequestReviewers:{id:string;name:string}[];
    tasks: Row<Task>[];
    ivy: Row<Ivy>[];
    ivyTaskDays?: IvyTaskDay[];
    ivyTasksEnabledFrom?: string;
    ivyTaskWarning?: string;
    ivyWecom?:{enabled:boolean;targetName:string;testMode:boolean;pauseReason:string|null;deliveries:{recordId:string;recordVersion:number;status:string;errorMessage:string|null;completedAt:string|null}[]};
    notes: Row<Note>[];
    links: Row<{
        text: string;
        taskId: string;
        decisionComment?: string;
    }>[];
    appeals: Row<{
        targetKind?:string;
        targetRecordId?: string;
        recordId?: string;
        entityId?: string | null;
        targetVersion: number;
        recordVersion?: number;
        targetSnapshot?: unknown;
        reason: string;
        decision?: string;
        comment?: string;
    }>[];
    calendar: Row<Calendar> | null;
    inbox: {
        id: string;
        title: string;
        body?: string;
        readAt?: string | null;
        recordId?: string;
        entityId?: string | null;
    }[];
};
export type Mutate = (path: string, body: unknown, method?: string) => Promise<boolean>;
export const field = 'mt-2 block w-full min-w-0 rounded-xl border border-[#ded8c6] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e6bf30] disabled:bg-[#f3f1e9]';
export const labels: Record<string, string> = { DRAFT: '草稿', OPEN: '待接取', PROPOSED: '待确认价值与难度', ACTIVE: '进行中', SUBMITTED: '待验收', COMPLETED: '已验收', RETURNED: '退回修改', REJECTED: '已拒绝', DEFERRED: '暂缓', REVIEWED: '已评分', PENDING: '待审核', RESOLVED: '已处理', SELF:'自拟任务', AI: '中台任务', IVY: '艾维利归集', LEARNING: '学习行动' };
export const statusLabel = (s: string) => labels[s] ?? s;
export function errorText(error: unknown) { return error instanceof Error ? error.message : '操作失败，请稍后手动重试'; }
export function request<T>(path: string, signal?: AbortSignal) { return apiClient.request<T>(`/api/ai-center${path}`, { signal }, false); }
export function write<T>(path: string, body: unknown, method = 'POST') { return apiClient.request<T>(`/api/ai-center${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, false); }
export function iso(value: string) { const date = new Date(value); if (Number.isNaN(date.getTime()))
    throw new Error('请选择有效的预计交付日期'); return date.toISOString(); }
export function localDateTime(value?: string) { if (!value)
    return ''; const d = new Date(value); if (Number.isNaN(d.getTime()))
    return ''; return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
export function dateText(value?: string) { return value ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '尚未记录'; }
export function monday(value: string) { const d = new Date(`${value}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); }

export type GrowthRating = 'S'|'A+'|'A'|'A-'|'B'|'C';
export type GrowthTarget=Row<{rating:GrowthRating|null;archiveComment:string;periodStart:string;periodEnd:string;updatedBy:string}>;
