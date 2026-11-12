"use client";

import { BrandLogo, Button, Card } from "@fangpian/ui";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useSessionStore } from "@/stores/session-store";
import { BlurText } from "@/components/motion/page-motion";
import { loginDestination } from "@/features/projects/project-links";
import Link from 'next/link';
import { useRef, useSyncExternalStore } from 'react';
import { apiClient } from '@/lib/api';
import { traineeDestination } from '@/features/trainees/access';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const subscribeLocation = () => () => {};
const registrationAccount = () => new URLSearchParams(window.location.search).get('account') ?? '';

export default function LoginPage() {
  const router = useRouter();
  const initialAccount = useSyncExternalStore(subscribeLocation, registrationAccount, () => '');
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const pending = useRef(false);
  const rotateAccessToken = useSessionStore((state) => state.rotateAccessToken);

  async function login(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email ?? initialAccount, password }),
      });
      if (!response.ok) throw new Error("登录失败，请检查账号和密码");
      const result = (await response.json()) as {
        accessToken: string;
        mustChangePassword: boolean;
      };
      useSessionStore.getState().clearSession();
      rotateAccessToken(result.accessToken);
      const user = await apiClient.request<{ roles: string[] }>('/api/users/me');
      router.push(
        result.mustChangePassword
          ? loginDestination(window.location.search, true)
          : traineeDestination(user.roles ?? [], loginDestination(window.location.search, false)),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登录失败");
    } finally {
      setLoading(false);
      pending.current = false;
    }
  }

  return (
    <main className="min-h-screen overflow-hidden px-5 py-6 text-[#303030] sm:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-[1480px] gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <section className="relative flex min-h-[520px] flex-col overflow-hidden rounded-[36px] bg-[#303030] p-8 text-white sm:p-12 lg:p-16">
          <BrandLogo
            variant="wordmark-inverse"
            className="h-16 w-52 object-contain object-left"
          />
          <div className="relative z-10 my-auto max-w-2xl py-10 pb-32 sm:py-14">
            <span className="inline-flex rounded-full bg-[#ffd85f] px-4 py-2 text-sm font-extrabold text-[#303030]">
              企业内部价值与产能流动平台
            </span>
            <h1 className="mt-7 text-4xl font-black leading-[1.08] tracking-[-.045em] sm:text-6xl">
              <BlurText>让敢想的事，</BlurText>
              <br />
              <BlurText delay={100}>被真正做成。</BlurText>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/65">
              让公司的问题找到最适合解决它的人，让闲置产能持续流向真正有价值的挑战。
            </p>
          </div>
          <p className="relative z-10 max-w-40 text-sm text-white/40 sm:max-w-none">
            方片组织价值网络 · 内部系统
          </p>
          <div className="fp-hero-orb absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-[#ffd85f]" />
          <Image
            src="/brand/tiger-open-arms.webp"
            alt=""
            width={640}
            height={640}
            priority
            className="fp-tiger-peek absolute bottom-0 right-1 h-auto w-44 object-contain sm:w-80"
          />
        </section>
        <Card className="flex items-center p-7 sm:p-12 lg:p-14">
          <div className="mx-auto w-full max-w-md">
            <p className="text-sm font-extrabold tracking-[.16em] text-[#8a761f]">
              EMPLOYEE ACCESS
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-[-.04em]">
              欢迎回来
            </h2>
            <p className="mt-3 text-[#6d685e]">
              登录后继续推进你的项目、申请与交付。
            </p>
            <form className="fp-stagger mt-9 space-y-5" onSubmit={login}>
              <label className="block text-sm font-bold">
                账号或邮箱
                <input
                  className="mt-2 h-14 w-full rounded-2xl border border-black/12 bg-white px-4 outline-none transition focus:border-[#d3aa16] focus:ring-4 focus:ring-[#ffd85f]/35"
                  value={email ?? initialAccount}
                  onChange={(event) => setEmail(event.target.value)}
                  type="text"
                  autoComplete="username"
                  required
                />
              </label>
              <div>
                <label
                  htmlFor="login-password"
                  className="block text-sm font-bold"
                >
                  密码
                </label>
                <div className="relative mt-2">
                  <input
                    id="login-password"
                    className="h-14 w-full rounded-2xl border border-black/12 bg-white pl-4 pr-14 outline-none transition focus:border-[#d3aa16] focus:ring-4 focus:ring-[#ffd85f]/35"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "隐藏密码" : "显示密码"}
                    aria-pressed={showPassword}
                    className="absolute right-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-xl text-[#6d685e] hover:bg-[#fff3bf] hover:text-[#303030]"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <Button
                className="h-14 w-full"
                disabled={loading}
                loading={loading}
              >
                {loading ? "正在登录…" : "进入工作台"}
              </Button>
              {message ? (
                <p
                  role="alert"
                  className="rounded-2xl bg-[#303030] p-4 text-sm text-white"
                >
                  {message}
                </p>
              ) : null}
            </form>
            <p className="mt-7 text-center text-sm text-[#6d685e]">
              新管培生？<Link href="/register" className="ml-1 font-bold underline underline-offset-4">注册入驻</Link>
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
