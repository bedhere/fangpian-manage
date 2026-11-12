export type AdminNavigationItem = {
  id: string;
  label: string;
  href: string;
};

const adminNavigationItems: AdminNavigationItem[] = [
  { id: "overview", label: "治理总览", href: "/" },
  { id: "organization", label: "组织与成员", href: "/organization" },
  { id: "access", label: "权限与策略", href: "/access" },
  { id: "rules", label: "业务规则", href: "/rules" },
  { id: "ai", label: "AI 配置", href: "/ai" },
  { id: "notifications", label: "通知中心", href: "/notifications" },
  { id: "audit", label: "审计日志", href: "/audit" },
  { id: "health", label: "系统健康", href: "/health" },
];

export function getAdminNavigationItems(): AdminNavigationItem[] {
  return [...adminNavigationItems];
}
