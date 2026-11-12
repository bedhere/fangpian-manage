"use client";
import { SlideSubmit } from '@fangpian/ui';



import { Card } from "@fangpian/ui";
import { type FormEvent, useEffect, useState } from "react";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
type Field = { path: string; label: string; type: "number" | "boolean" | "string" | "number-array" | "string-array"; min?: number; max?: number };
type Definition = { key: string; label: string; group: string; fields: Field[] };
type Setting = { id: string; key: string; value: unknown; version: number };
function fieldValue(value: unknown, path: string) { return path === "$" ? value : value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>)[path] : undefined; }

export function RulesView() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [message, setMessage] = useState("正在读取规则注册表");
  async function load(token: string) {
    const headers = { authorization: `Bearer ${token}` };
    const [settingsResponse, definitionsResponse] = await Promise.all([fetch(`${api}/api/admin/settings`, { headers }), fetch(`${api}/api/admin/setting-definitions`, { headers })]);
    if (!settingsResponse.ok || !definitionsResponse.ok) { setMessage("规则读取失败或权限不足"); return; }
    setSettings(await settingsResponse.json() as Setting[]); setDefinitions(await definitionsResponse.json() as Definition[]); setMessage("");
  }
  useEffect(() => { const token = sessionStorage.getItem("valueflow_admin_token"); const timer = token ? window.setTimeout(() => void load(token), 0) : undefined; return () => { if (timer !== undefined) window.clearTimeout(timer); }; }, []);
  async function save(event: FormEvent<HTMLFormElement>, setting: Setting, definition: Definition) {
    event.preventDefault(); const form = new FormData(event.currentTarget); let value: unknown = {};
    for (const field of definition.fields) {
      const raw = String(form.get(field.path) ?? "");
      const parsed = field.type === "number" ? Number(raw) : field.type === "boolean" ? raw === "true" : field.type === "number-array" ? raw.split(",").filter(Boolean).map(Number) : field.type === "string-array" ? raw.split(",").map((item) => item.trim()).filter(Boolean) : raw;
      if (field.path === "$") value = parsed; else (value as Record<string, unknown>)[field.path] = parsed;
    }
    const token = sessionStorage.getItem("valueflow_admin_token"); const reason = String(form.get("reason") ?? "");
    const response = await fetch(`${api}/api/admin/settings/${setting.id}`, { method: "PATCH", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: setting.version, value, reason }) });
    const body = await response.json() as { message?: string }; setMessage(response.ok ? `${definition.label}已更新并保留旧版本` : body.message ?? "更新失败"); if (response.ok && token) await load(token);
   return response.ok; }
  return <div>{message ? <p role="status" className="mt-5 rounded-2xl bg-[#303030] p-4 text-white">{message}</p> : null}<div className="mt-8 grid gap-5 xl:grid-cols-2">{settings.map((setting) => { const definition = definitions.find((item) => item.key === setting.key); if (!definition) return null; return <Card key={setting.id} className="p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-widest text-[#8a761f]">{definition.group}</p><h2 className="mt-1 text-xl font-black">{definition.label}</h2><p className="text-xs text-[#777166]">{setting.key}</p></div><b>v{setting.version}</b></div><form className="mt-5 grid gap-4" onSubmit={(event) => event.preventDefault()}>{definition.fields.map((field) => <label key={field.path} className="grid gap-1 text-sm font-bold">{field.label}{field.type === "boolean" ? <select name={field.path} defaultValue={String(fieldValue(setting.value, field.path))} className="h-11 rounded-xl border border-black/10 bg-white px-3"><option value="true">启用</option><option value="false">停用</option></select> : <input name={field.path} type={field.type === "number" ? "number" : "text"} min={field.min} max={field.max} defaultValue={Array.isArray(fieldValue(setting.value, field.path)) ? (fieldValue(setting.value, field.path) as unknown[]).join(",") : String(fieldValue(setting.value, field.path) ?? "")} className="h-11 rounded-xl border border-black/10 bg-white px-3" />}</label>)}<input name="reason" required minLength={2} placeholder="填写本次修改原因" className="h-11 rounded-xl border border-black/10 bg-white px-3"/><SlideSubmit label="滑动保存规则" doneLabel="已保存" onConfirm={(form) => save({ preventDefault() {}, currentTarget: form } as FormEvent<HTMLFormElement>, setting, definition)} /></form></Card>; })}</div></div>;
 }
