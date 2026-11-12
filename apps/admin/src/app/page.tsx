"use client";

import { BrandLogo, Button, Card } from "@fangpian/ui";
import { type FormEvent, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell/admin-shell";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
type Setting = { id: string; key: string; value: unknown; version: number };
type Audit = { id: string; action: string; entityType: string; entityId: string; createdAt: string; actor: { displayName: string } | null };

export default function AdminHome() {
  const [token, setToken] = useState("");
  const [settings, setSettings] = useState<Setting[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [message, setMessage] = useState("请使用管理员账号登录");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('passwordReset') === '1') setMessage('密码已重置，请使用新密码重新登录；登录后需修改临时密码。');
    const saved = sessionStorage.getItem("valueflow_admin_token");
    if (saved) void load(saved);
  }, []);

  async function load(value: string) {
    setToken(value);
    const headers = { authorization: `Bearer ${value}` };
    const responses = await Promise.all([
      fetch(`${api}/api/admin/settings`, { headers }),
      fetch(`${api}/api/admin/audit-logs`, { headers }),
    ]);
    if (responses.some((item) => !item.ok)) {
      setMessage("无权访问治理数据");
      return;
    }
    setSettings((await responses[0].json()) as Setting[]);
    setAudits((await responses[1].json()) as Audit[]);
    setMessage("");
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`${api}/api/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });
    const body = (await response.json()) as { accessToken?: string; message?: string; mustChangePassword?: boolean };
    if (!response.ok || !body.accessToken) {
      setMessage(body.message ?? "登录失败");
      return;
    }
    sessionStorage.setItem("valueflow_admin_token", body.accessToken);
    if (body.mustChangePassword) {
      const webUrl = process.env.NEXT_PUBLIC_WEB_URL ?? api.replace(/:([0-9]+)$/, (_, port: string) => `:${Number(port) - 1}`);
      window.location.assign(`${webUrl}/change-password`);
      return;
    }
    const identityResponse = await fetch(`${api}/api/users/me`, { headers: { authorization: `Bearer ${body.accessToken}` } });
    if (identityResponse.ok) {
      const identity = await identityResponse.json() as { permissions: string[] };
      if (identity.permissions.includes("user:manage") && !identity.permissions.includes("setting:manage")) {
        window.location.assign("/organization");
        return;
      }
    }
    await load(body.accessToken);
  }

  async function update(setting: Setting) {
    const raw = prompt(`修改 ${setting.key}（JSON）`, JSON.stringify(setting.value, null, 2));
    if (!raw) return;
    let value: Record<string, unknown>;
    try { value = JSON.parse(raw) as Record<string, unknown>; }
    catch { setMessage("JSON 格式无效"); return; }
    const reason = prompt("填写修改原因");
    if (!reason) return;
    const response = await fetch(`${api}/api/admin/settings/${setting.id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ expectedVersion: setting.version, value, reason }),
    });
    const body = (await response.json()) as { message?: string };
    setMessage(response.ok ? "规则已更新并写入审计" : body.message ?? "更新失败");
    if (response.ok) await load(token);
  }

  if (!token) return <main className="grid min-h-screen place-items-center px-5">
    <Card className="grid w-full max-w-4xl overflow-hidden md:grid-cols-[.8fr_1.2fr]">
      <section className="relative overflow-hidden bg-[#303030] p-9 text-white">
        <BrandLogo variant="wordmark-inverse" className="h-14 w-44 object-contain object-left" />
        <h1 className="mt-20 text-4xl font-black">平台治理<br />清晰可追溯</h1>
        <p className="mt-4 text-sm leading-6 text-white/55">组织、权限、规则与审计的独立管理入口。</p>
        <div className="absolute -bottom-24 -right-24 h-52 w-52 rounded-full bg-[#ffd85f]" />
      </section>
      <form onSubmit={login} className="p-9 sm:p-12">
        <p className="text-sm font-extrabold tracking-[.14em] text-[#8a761f]">ADMIN ACCESS</p>
        <h2 className="mt-2 text-3xl font-black">管理控制台</h2>
        <input name="email" type="text" autoComplete="username" aria-label="账号或邮箱" placeholder="账号或邮箱" className="mt-7 h-13 w-full rounded-2xl border border-black/10 bg-white px-4 outline-none focus:ring-4 focus:ring-[#ffd85f]/40" />
        <input name="password" type="password" autoComplete="current-password" aria-label="密码" className="mt-3 h-13 w-full rounded-2xl border border-black/10 bg-white px-4 outline-none focus:ring-4 focus:ring-[#ffd85f]/40" />
        <Button className="mt-5 h-13 w-full">登录治理后台</Button>
        <p role="status" className="mt-4 text-sm text-[#6d685e]">{message}</p>
      </form>
    </Card>
  </main>;

  return <AdminShell>
    <header><p className="text-sm font-extrabold tracking-[.14em] text-[#8a761f]">GOVERNANCE</p><h1 className="mt-2 text-4xl font-black">治理总览</h1></header>
    {message ? <p role="status" className="mt-5 rounded-2xl bg-[#303030] p-4 text-white">{message}</p> : null}
    <section className="mt-8"><h2 className="text-xl font-black">系统规则</h2><div className="mt-4 grid gap-4 lg:grid-cols-2">
      {settings.map((setting) => <Card key={setting.id} role="button" tabIndex={0} onClick={() => update(setting)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void update(setting); } }} className="cursor-pointer p-5 text-left"><div className="flex justify-between"><strong>{setting.key}</strong><span className="font-bold text-[#9a7b00]">v{setting.version}</span></div><pre className="mt-3 overflow-auto text-xs text-[#6d685e]">{JSON.stringify(setting.value, null, 2)}</pre></Card>)}
    </div></section>
    <section className="mt-10"><h2 className="text-xl font-black">最近审计</h2><Card className="mt-4 overflow-hidden shadow-none">
      {audits.slice(0, 30).map((item) => <article key={item.id} className="grid gap-2 border-b border-black/8 p-4 sm:grid-cols-[1fr_1fr_auto]"><div><strong>{item.action}</strong><p className="text-xs text-[#777166]">{item.entityType} · {item.entityId}</p></div><span>{item.actor?.displayName ?? "系统"}</span><time className="text-sm text-[#777166]">{new Date(item.createdAt).toLocaleString("zh-CN")}</time></article>)}
    </Card></section>
  </AdminShell>;
}
