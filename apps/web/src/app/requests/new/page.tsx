"use client";

import { RequestForm, type BusinessRequestInput } from "@/features/requests/request-form";
import { apiClient } from "@/lib/api";
import { Card } from "@fangpian/ui";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewRequestPage() {
  const router = useRouter();
  async function create(input: BusinessRequestInput) {
    const request = await apiClient.request<{ id: string }>("/api/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    router.push(`/requests/${request.id}`);
  }

  return <main className="min-h-screen px-5 py-8">
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[.75fr_1.25fr]">
      <section className="rounded-[32px] bg-[#ffd85f] p-8 lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)]">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-black"><ArrowLeft size={16} /> 返回工作台</Link>
        <div className="mt-20"><Sparkles size={42} /><p className="mt-6 text-sm font-black tracking-[.16em]">NEW REQUEST</p><h1 className="mt-3 text-5xl font-black leading-[1.05] tracking-[-.05em]">先把问题<br />说清楚。</h1><p className="mt-5 max-w-sm leading-8 text-black/65">系统会保留原始需求事实，再判断由 AI 独立完成，还是形成项目交给最合适的人。</p></div>
      </section>
      <Card className="p-7 sm:p-10"><p className="text-sm font-black text-[#777166]">需求诊断 · 第一步</p><h2 className="mt-2 text-3xl font-black">描述真实业务问题</h2><p className="mb-8 mt-3 text-sm leading-7 text-[#777166]">无需先想解决方案，越具体的事实越有助于判断正确路线。</p><RequestForm onSubmit={create} /></Card>
    </div>
  </main>;
}
