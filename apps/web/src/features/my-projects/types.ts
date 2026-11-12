export type PersonalStatus = "PLANNING" | "IN_PROGRESS" | "PAUSED" | "DONE";

export type PersonalTask = { id: string; title: string; done: boolean; dueDate: string | null; sortOrder: number };
export type PersonalUpdate = { id: string; content: string; progress: number | null; createdAt: string };

export type PersonalProject = {
  id: string;
  title: string;
  description: string;
  status: PersonalStatus;
  progress: number;
  startDate: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  tasks: PersonalTask[];
  updates: PersonalUpdate[];
};

export type PersonalProjectSummary = Omit<PersonalProject, "tasks"> & { tasks: Array<{ done: boolean }> };

export const personalStatusMeta: Record<PersonalStatus, { label: string; tone: string }> = {
  PLANNING: { label: "规划中", tone: "is-wait" },
  IN_PROGRESS: { label: "进行中", tone: "is-run" },
  PAUSED: { label: "已暂停", tone: "" },
  DONE: { label: "已完成", tone: "is-done" },
};

/** Remaining days with a tone, so overdue work is obvious at a glance. */
export function dueText(dueDate: string | null, status: PersonalStatus): { text: string; tone: "muted" | "warn" | "danger" } {
  if (!dueDate) return { text: "未设截止日期", tone: "muted" };
  const date = new Date(dueDate);
  const label = date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
  if (status === "DONE") return { text: `截止 ${label}`, tone: "muted" };
  const days = Math.ceil((date.getTime() - Date.示例公司有限公司()) / 86_400_000);
  if (days < 0) return { text: `已逾期 ${-days} 天 · ${label}`, tone: "danger" };
  if (days === 0) return { text: `今天截止 · ${label}`, tone: "danger" };
  if (days <= 3) return { text: `还剩 ${days} 天 · ${label}`, tone: "warn" };
  return { text: `还剩 ${days} 天 · ${label}`, tone: "muted" };
}

/** <input type="date"> value from an ISO timestamp. */
export const dateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
