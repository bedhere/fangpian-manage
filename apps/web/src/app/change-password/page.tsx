"use client";

import { BrandLogo, Button, Card } from "@fangpian/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useSessionStore } from "@/stores/session-store";
import { traineeDestination } from '@/features/trainees/access';
import {
  loginReturnFromSearch,
  safeLoginUrl,
} from "@/features/projects/project-links";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  useEffect(() => {
    void apiClient
      .request<{ username?: string; email: string; roles: string[] }>("/api/users/me")
      .then((user) => {
        setAccount(user.username ?? user.email);
        setRoles(user.roles ?? []);
        setReady(true);
      })
      .catch(() =>
        router.replace(
          safeLoginUrl(
            loginReturnFromSearch(window.location.search) ?? "",
          ),
        ),
      );
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword"));
    const newPassword = String(form.get("newPassword"));
    if (newPassword !== form.get("confirmation")) {
      setMessage("两次输入的新密码不一致");
      return;
    }
    if (newPassword === currentPassword || newPassword === "DEMO_ONLY_ChangeMe_2026!") {
      setMessage("请设置与初始密码不同的新密码");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const result = await apiClient.request<{ accessToken: string }>(
        "/api/auth/change-password",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ currentPassword, newPassword }),
        },
      );
      useSessionStore.getState().rotateAccessToken(result.accessToken);
      router.replace(
        traineeDestination(roles, loginReturnFromSearch(window.location.search) ?? "/dashboard"),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "修改失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <Card className="w-full max-w-lg p-8 sm:p-10">
        <BrandLogo
          variant="wordmark"
          className="h-14 w-44 object-contain object-left"
        />
        <h1 className="mt-8 text-3xl font-black">设置你的新密码</h1>
        <p className="mt-3 text-sm leading-6 text-[#6d685e]">
          首次登录需要修改初始密码，完成后即可进入工作台。
        </p>
        {account ? (
          <p className="mt-3 text-sm font-bold">当前账号：{account}</p>
        ) : null}
        <form className="mt-7 space-y-5" onSubmit={submit}>
          {[
            {
              name: "currentPassword",
              label: "当前密码",
              complete: "current-password",
              min: 8,
            },
            {
              name: "newPassword",
              label: "新密码（至少 10 位）",
              complete: "new-password",
              min: 10,
            },
            {
              name: "confirmation",
              label: "再次输入新密码",
              complete: "new-password",
              min: 10,
            },
          ].map((field) => (
            <label key={field.name} className="block text-sm font-bold">
              {field.label}
              <input
                name={field.name}
                type="password"
                autoComplete={field.complete}
                minLength={field.min}
                maxLength={128}
                required
                className="mt-2 h-13 w-full rounded-2xl border border-black/10 bg-white px-4 outline-none focus:ring-4 focus:ring-[#ffd85f]/40"
              />
            </label>
          ))}
          {message ? (
            <p
              role="alert"
              className="rounded-2xl bg-[#303030] p-4 text-sm text-white"
            >
              {message}
            </p>
          ) : null}
          <Button className="h-13 w-full" disabled={!ready || loading}>
            {loading ? "正在修改…" : "保存密码并进入工作台"}
          </Button>
        </form>
      </Card>
    </main>
  );
}

