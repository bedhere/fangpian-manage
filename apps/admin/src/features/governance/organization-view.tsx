"use client";
import { SlideCommit } from '@fangpian/ui';

import { FeedbackButton, FeedbackForm } from '@fangpian/ui';


import { Button, Card } from "@fangpian/ui";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { PasswordReset } from './password-reset';

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
type User = { id: string; displayName: string; email: string; username?: string; mustChangePassword?: boolean; canResetPassword?: boolean; status: string; department: { name: string } | null; roles: { role: { code: string } }[] };
type Department = { id: string; name: string; code: string; status: string; head: { displayName: string } | null; _count: { members: number } };
type UserPage = { items: User[]; total: number; page: number; pageSize: number };
type Role = { id: string; name: string; code: string };

export function OrganizationView() {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("正在读取组织数据");
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const pageRef = useRef(1), searchRef = useRef('');
  const loadController = useRef<AbortController | null>(null);
  const load = useCallback(async (token: string, nextPage = pageRef.current, nextSearch = searchRef.current) => {
    loadController.current?.abort();
    const controller = new AbortController(); loadController.current = controller;
    const headers = { authorization: `Bearer ${token}` };
    try {
    const [usersResponse, departmentsResponse, rolesResponse] = await Promise.all([
      fetch(`${api}/api/admin/users?${new URLSearchParams({ page: String(nextPage), pageSize: "20", ...(nextSearch ? { search: nextSearch } : {}) })}`, { headers, signal: controller.signal, cache: 'no-store' }),
      fetch(`${api}/api/admin/departments`, { headers, signal: controller.signal }),
      fetch(`${api}/api/admin/roles`, { headers, signal: controller.signal }),
    ]);
    if (controller.signal.aborted || sessionStorage.getItem('valueflow_admin_token') !== token) return;
    if (!usersResponse.ok) { setMessage("成员账号读取失败或权限不足"); return; }
    const userPage = await usersResponse.json() as UserPage;
    const departmentList = departmentsResponse.ok ? await departmentsResponse.json() as Department[] : [];
    const roleList = rolesResponse.ok ? await rolesResponse.json() as Role[] : [];
    if (controller.signal.aborted || sessionStorage.getItem('valueflow_admin_token') !== token) return;
    setUsers(userPage.items); setPage(userPage.page); setTotal(userPage.total);
    pageRef.current = userPage.page; searchRef.current = nextSearch; setSearch(nextSearch);
    setDepartments(departmentList); setRoles(roleList);
    setMessage("");
    } catch { if (!controller.signal.aborted) setMessage('组织数据读取失败，请稍后手动刷新'); }
  }, []);
  useEffect(() => { const token = sessionStorage.getItem("valueflow_admin_token"); const timer = token ? window.setTimeout(() => void load(token), 0) : undefined; return () => { if (timer !== undefined) window.clearTimeout(timer); loadController.current?.abort(); }; }, [load]);
  async function setStatus(user: User, status: "ACTIVE" | "SUSPENDED") {
    const token = sessionStorage.getItem("valueflow_admin_token");
    const response = await fetch(`${api}/api/admin/users/${user.id}`, { method: "PATCH", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ status, reason: "管理员在成员列表调整状态" }) });
    const body = await response.json() as { message?: string };
    setMessage(response.ok ? `${user.displayName} 状态已更新` : body.message ?? "更新失败");
    if (response.ok && token) await load(token);
   return response.ok; }
  async function createDepartment(event: FormEvent<HTMLFormElement>) { const submitForm = event.currentTarget;  event.preventDefault(); const token = sessionStorage.getItem("valueflow_admin_token"); const data = new FormData(event.currentTarget); const response = await fetch(`${api}/api/admin/departments`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ name: data.get("name"), code: data.get("code") }) }); const body = await response.json() as { message?: string }; setMessage(response.ok ? "部门已创建" : body.message ?? "创建失败"); if (response.ok && token) { submitForm.reset(); await load(token); }  return response.ok; }
  async function createUser(event: FormEvent<HTMLFormElement>) { const submitForm = event.currentTarget;  event.preventDefault(); const token = sessionStorage.getItem("valueflow_admin_token"); const data = new FormData(event.currentTarget); const response = await fetch(`${api}/api/admin/users`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ displayName: data.get("displayName"), email: data.get("email"), password: data.get("password"), departmentId: data.get("departmentId") || undefined, roleIds: data.getAll("roleIds") }) }); const body = await response.json() as { message?: string }; setMessage(response.ok ? "成员已创建" : body.message ?? "创建失败"); if (response.ok && token) { submitForm.reset(); await load(token); }  return response.ok; }
  function searchUsers(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const token = sessionStorage.getItem("valueflow_admin_token"); const nextSearch = String(new FormData(event.currentTarget).get("search") ?? ""); if (token) void load(token, 1, nextSearch); }
  function changePage(nextPage: number) { const token = sessionStorage.getItem("valueflow_admin_token"); if (token) void load(token, nextPage, search); }
  return <div>
    {passwordUser ? <PasswordReset key={passwordUser.id} user={passwordUser} onClose={() => setPasswordUser(null)} onReset={notice => { setMessage(notice); setUsers(current => current.map(row => row.id === passwordUser.id ? { ...row, mustChangePassword: true } : row)); }} /> : null}
    {message ? <p role="status" className="mt-5 rounded-2xl bg-[#303030] p-4 text-white">{message}</p> : null}
    <section className="mt-8"><div className="flex items-center justify-between"><h2 className="text-xl font-black">部门</h2></div><FeedbackForm onSubmit={(event) => createDepartment(event)} className="mt-4 grid gap-3 rounded-3xl bg-[#fff4c9] p-4 sm:grid-cols-[1fr_1fr_auto]"><input name="name" required minLength={2} placeholder="部门名称" className="h-11 rounded-xl border border-black/10 bg-white px-3"/><input name="code" required minLength={2} placeholder="部门编码" className="h-11 rounded-xl border border-black/10 bg-white px-3"/><FeedbackButton successLabel="已创建" className="fp-button fp-button--primary">创建部门</FeedbackButton></FeedbackForm><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{departments.map((department) => <Card key={department.id} className="p-5"><strong>{department.name}</strong><p className="mt-2 text-sm text-[#777166]">{department.code} · {department._count.members} 人</p><p className="text-sm">负责人：{department.head?.displayName ?? "未设置"}</p></Card>)}</div></section>
    <section className="mt-10"><h2 className="text-xl font-black">创建成员</h2><FeedbackForm onSubmit={(event) => createUser(event)} className="mt-4 grid gap-3 rounded-3xl bg-[#303030] p-5 text-white md:grid-cols-2"><input name="displayName" required minLength={2} placeholder="姓名" className="h-11 rounded-xl bg-white px-3 text-black"/><input name="email" required type="email" placeholder="邮箱" className="h-11 rounded-xl bg-white px-3 text-black"/><input name="password" required type="password" minLength={12} placeholder="初始密码（至少 12 位）" className="h-11 rounded-xl bg-white px-3 text-black"/><select name="departmentId" className="h-11 rounded-xl bg-white px-3 text-black"><option value="">未分配部门</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select><fieldset className="grid gap-2 md:col-span-2"><legend className="font-bold">初始角色</legend><div className="flex flex-wrap gap-3">{roles.map((role) => <label key={role.id} className="rounded-full bg-white/10 px-3 py-2 text-sm"><input className="mr-2" type="checkbox" name="roleIds" value={role.id}/>{role.name}</label>)}</div></fieldset><FeedbackButton successLabel="已创建" className="fp-button fp-button--primary md:col-span-2">创建成员</FeedbackButton></FeedbackForm></section>
    <section className="mt-10" aria-label="账号与密码管理">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-black">账号与密码管理（{total}人）</h2><form onSubmit={searchUsers} className="flex max-w-full gap-2"><input name="search" maxLength={200} defaultValue={search} aria-label="搜索成员账号" placeholder="搜索姓名、账号或邮箱" className="h-10 min-w-0 rounded-xl border border-black/10 bg-white px-3"/><Button>搜索</Button></form></div>
      <p className="mt-3 text-sm leading-6 text-[#777166]">查看本组织全部成员账号及密码状态。密码加密保存，可由有权限的管理员设置新密码。</p>
      <Card className="mt-4 overflow-hidden shadow-none">{users.map(user => <article key={user.id} className="grid min-w-0 gap-4 border-b border-black/8 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0"><strong>{user.displayName}</strong><p className="mt-2 break-all text-sm">登录账号：<span className="select-all font-bold">{user.username || user.email}</span></p><p className="mt-1 break-all text-xs text-[#777166]">邮箱：{user.email}</p></div>
        <div className="min-w-0"><p className="break-words text-sm">{user.department?.name ?? '未分配部门'} · {user.roles.map(item => item.role.code).join(' / ') || '未分配角色'}</p><p className="mt-2 text-sm">密码状态：<span className={user.mustChangePassword ? 'font-bold text-[#8a6711]' : 'text-[#777166]'}>{user.mustChangePassword ? '待改密（首次或重置后）' : '已设置'}</span></p><p className="mt-1 text-xs text-[#777166]">账号状态：{({ ACTIVE: '正常', SUSPENDED: '暂停', DISABLED: '已停用' } as Record<string, string>)[user.status] ?? user.status}</p></div>
        <div className="flex flex-wrap items-center gap-3"><Button type="button" variant="secondary" disabled={!user.canResetPassword} title={!user.canResetPassword ? '当前权限不能重置此账号密码' : undefined} onClick={() => setPasswordUser(user)}>重置密码</Button><SlideCommit label={user.status === 'ACTIVE' ? '滑动暂停成员' : '滑动启用成员'} doneLabel="已确认" onConfirm={() => setStatus(user, user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')} /></div>
      </article>)}{!users.length ? <p className="p-6 text-sm text-[#777166]">暂无匹配成员</p> : null}</Card>
      <div className="mt-4 flex flex-wrap justify-end gap-2"><button disabled={page <= 1} onClick={() => changePage(page - 1)} className="rounded-full border border-black/10 px-4 py-2 disabled:opacity-30">上一页</button><span className="px-3 py-2">第 {page} / {Math.max(1, Math.ceil(total / 20))} 页</span><button disabled={page * 20 >= total} onClick={() => changePage(page + 1)} className="rounded-full border border-black/10 px-4 py-2 disabled:opacity-30">下一页</button></div>
    </section>
  </div>;
 }

