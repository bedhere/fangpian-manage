import { Badge, Card } from "@fangpian/ui";
import { Bell, BookOpen, BriefcaseBusiness, CircleDollarSign, ClipboardCheck, ClipboardList, Lightbulb, ShieldCheck, Sparkles, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { notificationHref } from "@/lib/notification-destinations";
import { NotificationLink } from "@/components/app-shell/notification-link";
import { AnimatedContent, CountUp } from "../../components/motion/page-motion";

export type WorkspaceBootstrap = {
  user: { id: string; email: string; displayName: string; departmentName: string | null; capabilityLevel: string | null; reputationScore: number | null; roles: string[]; permissions: string[] };
  navigation: Array<{ id: string; label: string; href: string }>;
  counters: { activeProjects: number; pendingApplications: number; unreadNotifications: number; totalBonus: string };
  tasks: Array<{ id: string; title: string; status: string; deadline: string | null; updatedAt: string }>;
  notifications: Array<{ id: string; title: string; body: string; entityType: string | null; entityId: string | null; createdAt: string }>;
  workQueues?: { myProjects: number; myApplications: number; pendingScores: number; contributionDisputes: number; riskProjects: number; supervisedProjects: number; departmentProjects: number; departmentTodos?: number; skillVerifications: number };
};

const statusLabels: Record<string, string> = {
  OWNER_ASSIGNED: "待规划", PLANNING: "规划中", IN_PROGRESS: "推进中", AT_RISK: "有风险",
  DELIVERY_SUBMITTED: "待评审", AI_DELIVERY_REVIEW: "AI 评审中", BUSINESS_ACCEPTANCE: "业务验收", FINAL_RATING: "待评级",
};

const quickEntries = [
  { href: "/tasks", label: "部门待办", icon: ClipboardList },
  { href: "/requests", label: "我的需求", icon: ClipboardList },
  { href: "/opportunities", label: "内部机会", icon: Lightbulb },
  { href: "/knowledge", label: "知识库", icon: BookOpen },
  { href: "/circles", label: "临时圈子", icon: Users },
  { href: "/buffs", label: "AI Buff", icon: Sparkles },
  { href: "/rankings", label: "价值排行", icon: Trophy },
];

const riskStatuses = new Set(["AT_RISK"]);

function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 5) return "夜深了";
  if (hour < 11) return "早上好";
  if (hour < 13) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

/** Days until a deadline, with a tone so overdue and imminent work stands out at a glance. */
function deadlineInfo(deadline: string | null, 示例公司有限公司 = new Date()) {
  if (!deadline) return { text: "未设截止", tone: "muted" as const };
  const end = new Date(deadline);
  const days = Math.ceil((end.getTime() - 示例公司有限公司.getTime()) / 86_400_000);
  const date = end.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
  if (days < 0) return { text: `已逾期 ${-days} 天 · ${date}`, tone: "danger" as const };
  if (days === 0) return { text: `今天截止 · ${date}`, tone: "danger" as const };
  if (days <= 3) return { text: `还剩 ${days} 天 · ${date}`, tone: "warn" as const };
  return { text: `还剩 ${days} 天 · ${date}`, tone: "muted" as const };
}

export function DashboardView({ workspace }: { workspace: WorkspaceBootstrap }) {
  const amount = Number(workspace.counters.totalBonus || 0);
  const metrics = [
    { label: "进行中项目", value: workspace.counters.activeProjects, icon: BriefcaseBusiness, href: "/projects" },
    { label: "待处理申请", value: workspace.counters.pendingApplications, icon: ClipboardCheck, href: "/market" },
    { label: "未读动态", value: workspace.counters.unreadNotifications, icon: Bell, href: null },
    { label: "累计价值回报", value: amount, icon: CircleDollarSign, href: "/bonuses", currency: true },
  ];
  const queues: Array<[string, number, string]> = workspace.workQueues ? [
    ["我的项目", workspace.workQueues.myProjects, "/projects"],
    ["我的申请", workspace.workQueues.myApplications, "/market"],
    ["待评分", workspace.workQueues.pendingScores, "/reviews/delivery"],
    ["贡献争议", workspace.workQueues.contributionDisputes, "/settlements"],
    ["风险项目", workspace.workQueues.riskProjects, "/projects"],
    ["我的监督", workspace.workQueues.supervisedProjects, "/projects"],
    ["部门待办", workspace.workQueues.departmentTodos ?? 0, "/tasks"],
    ["技能验证", workspace.workQueues.skillVerifications, "/reviews/skills"],
  ] : [];
  const pendingQueues = queues.filter(([, count]) => count > 0);
  const clearQueues = queues.filter(([, count]) => count === 0);
  // Overdue and at-risk work first, then by nearest deadline.
  const tasks = [...workspace.tasks].sort((a, b) => {
    const risk = Number(riskStatuses.has(b.status)) - Number(riskStatuses.has(a.status));
    if (risk) return risk;
    return (a.deadline ? new Date(a.deadline).getTime() : Infinity) - (b.deadline ? new Date(b.deadline).getTime() : Infinity);
  });

  return <AnimatedContent className="fp-dash space-y-5">
    <section className="fp-dash__hello">
      <div className="min-w-0">
        <p className="text-sm font-bold text-[#777166]">{workspace.user.departmentName ?? "方片组织"} · {workspace.user.capabilityLevel ?? "成员"}</p>
        <h1 className="mt-1 text-3xl font-black tracking-[-.03em] sm:text-4xl">{greeting()}，{workspace.user.displayName}</h1>
        <p className="mt-2 text-[#5f5b52]">{tasks.length ? <>你手上有 <b className="text-[#303030]">{tasks.length}</b> 个项目在推进{pendingQueues.length ? <>，另有 <b className="text-[#303030]">{pendingQueues.reduce((sum, [, count]) => sum + count, 0)}</b> 项待处理</> : null}。</> : "今天没有需要你推进的项目，去机会市场看看新挑战吧。"}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <Link href="/market" className="fp-button fp-button--secondary inline-flex items-center">去机会市场</Link>
        <Link href="/requests/new" className="fp-button fp-button--primary inline-flex items-center gap-2">发起新需求<span className="fp-arrow" aria-hidden="true">→</span></Link>
        <img src="/brand/tiger-wink-wave.webp" alt="" className="fp-tiger-peek hidden h-20 w-20 object-contain xl:block" />
      </div>
    </section>

    <section className="fp-metrics" aria-label="关键数字">
      <div className="fp-metric fp-metric--accent">
        <span className="fp-metric__label"><ShieldCheck size={16} aria-hidden="true" />信誉分</span>
        <strong className="fp-metric__value">{workspace.user.reputationScore === null ? "—" : <CountUp value={workspace.user.reputationScore} />}</strong>
        <span className="fp-metric__hint">由真实交付持续更新</span>
      </div>
      {metrics.map(({ label, value, icon: Icon, href, currency }) => {
        const body = <><span className="fp-metric__label"><Icon size={16} aria-hidden="true" />{label}</span><strong className="fp-metric__value"><CountUp value={value} currency={currency} /></strong></>;
        return href ? <Link key={label} href={href} className="fp-metric fp-lift">{body}</Link> : <div key={label} className="fp-metric">{body}</div>;
      })}
    </section>

    <section className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
      <div className="space-y-5">
        <Card className="p-6">
          <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black"><Link href="/projects?view=OWNED">我推进的项目</Link></h2><Link className="text-sm font-bold text-[#5f5b52] hover:text-[#303030]" href="/projects?view=OWNED">查看全部 <span className="fp-arrow" aria-hidden="true">→</span></Link></div>
          {tasks.length ? <ul className="fp-task-list mt-3">{tasks.map((task) => {
            const due = deadlineInfo(task.deadline);
            const risky = riskStatuses.has(task.status);
            return <li key={task.id}><Link href={`/projects/${task.id}/manage`} className="fp-task" data-risk={risky || undefined}>
              <span className="min-w-0"><strong className="block truncate">{task.title}</strong><span className={`fp-due fp-due--${due.tone}`}>{due.text}</span></span>
              <Badge className={risky ? "fp-badge--danger" : undefined}>{statusLabels[task.status] ?? task.status}</Badge>
            </Link></li>;
          })}</ul> : <div className="py-8 text-center text-[#777166]"><img src="/brand/tiger-relaxed-seated.webp" alt="" className="fp-float mx-auto mb-3 h-20 w-20 object-contain" /><p>目前没有需要推进的项目</p><p className="mt-2 text-sm">接取项目并成为负责人后，可在这里查看完整时间轴。</p><Link href="/projects" className="mt-4 inline-flex text-sm font-black text-[#303030]">查看我发起或参与的项目 →</Link></div>}
        </Card>
        {queues.length ? <Card className="p-6">
          <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">待我处理</h2>{pendingQueues.length ? null : <span className="text-sm font-bold text-[#20725a]">全部清空</span>}</div>
          {pendingQueues.length ? <div className="fp-stagger mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{pendingQueues.map(([label, count, href]) => <Link key={label} href={href} className="fp-queue fp-lift" data-hot><span>{label}</span><strong>{count}</strong></Link>)}</div> : null}
          {clearQueues.length ? <p className="mt-4 flex flex-wrap gap-2 text-xs text-[#8a857a]">{clearQueues.map(([label, , href]) => <Link key={label} href={href} className="fp-queue-empty">{label} 0</Link>)}</p> : null}
        </Card> : null}
      </div>
      <Card className="p-6"><h2 className="text-xl font-black">最新动态</h2><div className="fp-stagger mt-3 divide-y divide-black/6">{workspace.notifications.length ? workspace.notifications.map((item) => {const href=notificationHref(item);const content=<><strong className="text-sm">{item.title}</strong><p className="mt-1 text-sm leading-6 text-[#5f5b52]">{item.body}</p><time className="text-xs text-[#8a857a]" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time></>;return <article key={item.id} className="py-3">{href?<NotificationLink id={item.id} href={href} className="block rounded-lg focus-visible:outline-2 focus-visible:outline-[#b08b21]">{content}<span className="mt-2 block text-xs font-bold text-[#8c6b12] underline">查看并处理 →</span></NotificationLink>:content}</article>;}) : <div className="py-10 text-center text-[#777166]"><img src="/brand/tiger-reading-seated.webp" alt="" className="mx-auto mb-3 h-20 w-20 object-contain" /><p>暂无未读动态</p></div>}</div></Card>
    </section>

    <nav aria-label="常用功能" className="fp-shortcuts">
      {quickEntries.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="fp-shortcut"><Icon size={18} aria-hidden="true" />{label}</Link>)}
    </nav>
  </AnimatedContent>;
}

