import { AdminShell } from "@/components/admin-shell/admin-shell";
import { RulesView } from "@/features/governance/rules-view";
export default function RulesPage() { return <AdminShell><header><p className="text-sm font-extrabold tracking-[.14em] text-[#8a761f]">RULE REGISTRY</p><h1 className="mt-2 text-4xl font-black">业务规则</h1><p className="mt-3 text-[#777166]">字段、类型和范围由服务端注册表定义，修改采用版本冲突保护。</p></header><RulesView /></AdminShell>; }
