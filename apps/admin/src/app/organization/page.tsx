import { AdminShell } from "@/components/admin-shell/admin-shell";
import { OrganizationView } from "@/features/governance/organization-view";

export default function OrganizationPage() {
  return <AdminShell><header><p className="text-sm font-extrabold tracking-[.14em] text-[#8a761f]">ORGANIZATION</p><h1 className="mt-2 text-4xl font-black">组织与成员</h1><p className="mt-3 text-[#777166]">真实组织数据、角色与账号状态；所有变更写入审计。</p></header><OrganizationView /></AdminShell>;
}
