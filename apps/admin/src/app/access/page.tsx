import { AdminShell } from "@/components/admin-shell/admin-shell";
import { AccessView } from "@/features/governance/access-view";
export default function AccessPage() { return <AdminShell><header><p className="text-sm font-extrabold tracking-[.14em] text-[#8a761f]">RBAC + ABAC</p><h1 className="mt-2 text-4xl font-black">权限与策略</h1><p className="mt-3 text-[#777166]">角色授权不能超过当前管理员自身权限，资源操作仍由服务端 ABAC 决定。</p></header><AccessView /></AdminShell>; }
