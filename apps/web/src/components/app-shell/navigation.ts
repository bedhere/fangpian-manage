import { isTraineeOnly } from '@/features/trainees/access';

export type NavigationContext = {
  roles: string[];
  permissions: string[];
};

export type NavigationItem = {
  id: string;
  label: string;
  href: string;
  description: string;
};

const employeeItems: NavigationItem[] = [
  { id: "dashboard", label: "工作台", href: "/dashboard", description: "今日重点与待办" },
  { id: "projects", label: "项目", href: "/projects", description: "发起并推进价值项目" },
  { id: "market", label: "机会市场", href: "/market", description: "寻找适合承接的任务" },
  { id: "bonuses", label: "价值回报", href: "/bonuses", description: "查看贡献与激励" },
  { id: 'profile', label: '示例公司有限公司画像', href: '/profile', description: '查看技能、贡献与成长' },
  { id: 'capacity', label: '我的产能', href: '/capacity', description: '维护可投入时间' },
  { id: 'rankings', label: '价值排行', href: '/rankings', description: '浏览七类组织排行' },
];

const reviewItem: NavigationItem = {
  id: "reviews",
  label: "审核中心",
  href: "/reviews",
  description: "处理业务与专业审核",
};

const executiveItem: NavigationItem = {
  id: "executive",
  label: "经营驾驶舱",
  href: "/executive",
  description: "洞察组织价值流动",
};
const settlementItem: NavigationItem = { id: 'settlements', label: '月结管理', href: '/settlements', description: '锁定并发放项目奖金' };

export function getNavigationItems(context: NavigationContext): NavigationItem[] {
  if (isTraineeOnly(context.roles)) return [traineeItem, leaderboardItem];
  const items = [...employeeItems, leaderboardItem];
  const permissionSet = new Set(context.permissions);

  if (
    permissionSet.has("project:business-review") ||
    permissionSet.has("project:technical-review")
  ) {
    items.push(reviewItem);
  }

  if (permissionSet.has("analytics:executive")) {
    items.push(executiveItem);
  }
  if (permissionSet.has('settlement:manage')) items.push(settlementItem);

  return items;
}

/** A nav entry stays highlighted on its own page and on every page beneath it. */
export function isNavigationItemActive(item: Pick<NavigationItem, "href">, pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export type NavigationGroup = {
  id: string;
  label: string;
  /** Groups with a direct href are plain links; the rest open a menu of items. */
  href?: string;
  items: NavigationItem[];
};

const projectGroup: NavigationItem[] = [
  { id: "my-projects", label: "我的项目", href: "/my-projects", description: "自建项目，拆任务、记进展" },
  { id: "projects", label: "项目中心", href: "/projects", description: "我发起、负责和参与的项目" },
  { id: "requests", label: "我的需求", href: "/requests", description: "提过的需求、AI 诊断与转化进度" },
  { id: "request-new", label: "发起需求", href: "/requests/new", description: "把一个问题交给组织来解决" },
];
const opportunityGroup: NavigationItem[] = [
  { id: "market", label: "机会市场", href: "/market", description: "寻找适合承接的项目" },
  { id: "opportunities", label: "内部机会", href: "/opportunities", description: "关注、提案并把机会转成需求" },
];
const traineeItem: NavigationItem = { id: 'trainees', label: '管培生入驻', href: '/trainees', description: '每日需求、方案与导师审核' };
const leaderboardItem: NavigationItem = { id: 'leaderboards', label: '排行榜', href: '/leaderboards', description: '按日期查看管培生打标签数量排行' };
const collaborationGroup: NavigationItem[] = [
  { id: "team-tasks", label: "部门待办", href: "/tasks", description: "任务派发、甘特进度、艾维利与绩效" },
  traineeItem,
  { id: "knowledge", label: "知识库", href: "/knowledge", description: "沉淀与复用经过双审的知识资产" },
  { id: "circles", label: "临时圈子", href: "/circles", description: "围绕一个话题快速组队讨论" },
  { id: "buffs", label: "AI Buff", href: "/buffs", description: "可复用的 AI 能力与运行记录" },
];
const departmentGroup: NavigationItem[] = [
  { id: 'ai-center', label: 'AI中台', href: '/ai-center', description: '双导师协作、任务交付、艾维利与每周学习成长' },
  { id: "external-collab", label: "商务", href: "/external-collab", description: "商务目标、方片周月业绩与订单依据" },
];
const growthGroup: NavigationItem[] = [
  { id: "bonuses", label: "价值回报", href: "/bonuses", description: "查看贡献与激励" },
  { id: "profile", label: "示例公司有限公司画像", href: "/profile", description: "查看技能、贡献与成长" },
  { id: "capacity", label: "我的产能", href: "/capacity", description: "维护可投入时间" },
  { id: "rankings", label: "价值排行", href: "/rankings", description: "浏览组织排行" },
];

/** Grouped navigation for the header: every employee page is reachable within two clicks. */
export function getNavigationGroups(context: NavigationContext): NavigationGroup[] {
  if (isTraineeOnly(context.roles)) return [{ id: 'ai-center', label: 'AI中台', href: '/ai-center', items: [] },{ id: 'trainees', label: '管培生档案', href: '/trainees', items: [] }, { id: 'leaderboards', label: '排行榜', href: '/leaderboards', items: [] }];
  const permissions = new Set(context.permissions);
  const manage: NavigationItem[] = [];
  if (permissions.has("project:business-review") || permissions.has("project:technical-review")) manage.push(reviewItem);
  if (permissions.has("analytics:executive")) {
    manage.push(executiveItem);
    manage.push({ id: "insights", label: "公司洞察", href: "/insights", description: "项目甘特与公司价值流" });
    manage.push({ id: "value-network", label: "价值网络", href: "/value-network", description: "需求、项目与人的价值连接" });
  }
  if (permissions.has("settlement:manage")) manage.push(settlementItem);

  const groups: NavigationGroup[] = [
    { id: "dashboard", label: "工作台", href: "/dashboard", items: [] },
    { id: "work", label: "项目", items: projectGroup },
    { id: "opportunity", label: "机会", items: opportunityGroup },
    { id: "collab", label: "协作", items: collaborationGroup },
    { id: "departments", label: "部门", items: departmentGroup },
    { id: "growth", label: "成长", items: growthGroup },
    { id: 'leaderboards', label: '排行榜', href: '/leaderboards', items: [] },
  ];
  if (manage.length) groups.push({ id: "manage", label: "管理", items: manage });
  return groups;
}

export function isNavigationGroupActive(group: NavigationGroup, pathname: string | null | undefined): boolean {
  if (group.href) return isNavigationItemActive({ href: group.href }, pathname);
  return group.items.some((item) => isNavigationItemActive(item, pathname));
}



