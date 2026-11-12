"use client";
import { FeedbackButton, FeedbackForm } from '@fangpian/ui';


import { Card } from "@fangpian/ui";
import { PageState } from "@/components/states/page-state";
import { apiClient } from "@/lib/api";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState } from "react";
type Profile = {
  id: string;
  name: string;
  department: string;
  capabilityLevel: string;
  reputationScore: number;
  contributionScore: number;
  totalBonus: number;
  completionRate: number;
  projectCount: number;
  completedCount: number;
  bio: string | null;
  timezone: string;
  isSelf: boolean;
  skills: Array<{
    name: string;
    proficiency: number;
    verificationStatus: string;
  }>;
  skillEvidence: Array<{
    id: string;
    status: string;
    grade: string;
    contributionPercentage: string;
    project: { title: string };
    skill: { name: string };
  }>;
  capabilityHistory: Array<{
    id: string;
    oldLevel: string;
    newLevel: string;
    reason: string;
    createdAt: string;
  }>;
  reputationEvents: Array<{
    id: string;
    type: string;
    delta: number;
    scoreAfter: number;
    createdAt: string;
  }>;
};
export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(
    () => apiClient.request<Profile>(`/api/profiles/${id}`).then(setProfile),
    [id],
  );
  useEffect(() => {
    load().catch((cause) =>
      setError(cause instanceof Error ? cause.message : "画像加载失败"),
    );
  }, [load]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await apiClient.request("/api/profiles/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bio: form.get("bio"),
        timezone: form.get("timezone"),
      }),
    });
    setMessage("示例公司有限公司资料已更新。");
    await load();
  }
  if (!profile)
    return (
      <main className="mx-auto max-w-3xl p-6">
        <PageState
          title={error ? "画像加载失败" : "正在计算能力画像"}
          description={error || "从项目、奖金、技能和信誉事实聚合"}
        />
      </main>
    );
  return (
    <main className="min-h-screen px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <Link href="/rankings" className="text-sm font-black">
          ← 返回价值排行
        </Link>
        <div className="mt-8 grid gap-5 lg:grid-cols-[.75fr_1.25fr]">
          <aside className="space-y-5">
            <Card className="bg-[#303030] p-7 text-white">
              <p className="text-sm text-white/60">{profile.department}</p>
              <h1 className="mt-2 text-4xl font-black">{profile.name}</h1>
              <p className="mt-4 text-sm text-white/70">
                {profile.bio || "尚未填写示例公司有限公司简介"}
              </p>
              <div className="mt-8 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-white/60">能力等级</p>
                  <strong className="text-3xl">
                    {profile.capabilityLevel}
                  </strong>
                </div>
                <div>
                  <p className="text-xs text-white/60">信誉分</p>
                  <strong className="text-3xl">
                    {profile.reputationScore}
                  </strong>
                </div>
              </div>
            </Card>
            <Card className="bg-[#ffd85f] p-6">
              <p className="text-sm font-bold">累计价值回报</p>
              <strong className="mt-2 block text-4xl">
                ¥ {profile.totalBonus.toFixed(2)}
              </strong>
              <p className="mt-3 text-sm">
                贡献分 {profile.contributionScore} · 完成率{" "}
                {profile.completionRate}%
              </p>
            </Card>
            {profile.isSelf ? (
              <Card className="p-6">
                <h2 className="text-xl font-black">编辑示例公司有限公司资料</h2>
                <FeedbackForm onSubmit={save} className="mt-4 grid gap-3">
                  <textarea
                    name="bio"
                    defaultValue={profile.bio ?? ""}
                    maxLength={1000}
                    placeholder="示例公司有限公司简介"
                    className="min-h-24 rounded-xl border border-black/10 p-3"
                  />
                  <input
                    name="timezone"
                    defaultValue={profile.timezone}
                    className="h-11 rounded-xl border border-black/10 px-3"
                  />
                  <FeedbackButton successLabel="已保存" className="rounded-2xl bg-[#303030] px-5 py-3 font-black text-white">
                    保存
                  </FeedbackButton>
                </FeedbackForm>
                {message ? <p className="mt-3 text-sm">{message}</p> : null}
              </Card>
            ) : null}
          </aside>
          <section className="space-y-5">
            <Card className="p-7">
              <h2 className="text-2xl font-black">技能雷达</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {profile.skills.map((skill) => (
                  <div key={skill.name} className="rounded-2xl bg-white p-4">
                    <div className="flex justify-between">
                      <strong>{skill.name}</strong>
                      <span>{skill.proficiency}/5</span>
                    </div>
                    <p className="mt-2 text-xs text-[#777166]">
                      {skill.verificationStatus === "VERIFIED"
                        ? "已验证"
                        : "自我声明"}
                    </p>
                  </div>
                ))}
              </div>
              {profile.skillEvidence.length ? (
                <div className="mt-5 border-t border-black/10 pt-5">
                  <h3 className="font-black">项目技能证据</h3>
                  <div className="mt-3 grid gap-2">
                    {profile.skillEvidence.map((item) => (
                      <div key={item.id} className="rounded-2xl bg-[#f7f4ea] p-4 text-sm">
                        <strong>{item.skill.name} · {item.status}</strong>
                        <p className="mt-1 text-[#777166]">{item.project.title} · {item.grade} 级 · 贡献 {item.contributionPercentage}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </Card>
            <Card className="p-7">
              <h2 className="text-2xl font-black">成长与信誉时间线</h2>
              <div className="mt-5 space-y-3">
                {profile.capabilityHistory.map((item) => (
                  <div key={item.id} className="rounded-2xl bg-white p-4">
                    <strong>
                      {item.oldLevel} → {item.newLevel}
                    </strong>
                    <p className="mt-1 text-sm text-[#777166]">{item.reason}</p>
                  </div>
                ))}
                {profile.reputationEvents.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between rounded-2xl bg-white p-4"
                  >
                    <span>{item.type}</span>
                    <strong>
                      {item.delta > 0 ? "+" : ""}
                      {item.delta} → {item.scoreAfter}
                    </strong>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        </div>
      </div>
    </main>
  );
}
