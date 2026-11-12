import { BrandLogo } from "@fangpian/ui";
import type { ReactNode } from "react";
import { AdminNav } from "./admin-nav";
import { getAdminNavigationItems } from "./navigation";

export function AdminShell({ children }: { children: ReactNode }) {
  return <div className="admin-shell">
    <aside className="admin-shell__sidebar">
      <BrandLogo variant="wordmark-inverse" className="admin-shell__logo" />
      <div className="admin-shell__title"><span>管理控制台</span><small>平台治理与配置</small></div>
      <AdminNav items={getAdminNavigationItems()} />
      <p className="admin-shell__notice">治理操作将自动写入审计日志</p>
    </aside>
    <main className="admin-shell__content">{children}</main>
  </div>;
}
