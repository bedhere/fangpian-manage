"use client";
import { FeedbackButton } from '@fangpian/ui';

import SlideCommit from '../../components/feedback/slide-commit';

import { useRef, useState } from "react";

export type ApplicationDecision = "APPROVED" | "SPECIAL_APPROVED" | "REJECTED";
export type ProjectApplication = {
  id: string;
  status: string;
  motivation: string;
  estimatedHours: string;
  relevantExperience: string;
  matchingScore: string;
  matchingBreakdown: { components?: Record<string, number> } | null;
  specialReviewReason: string | null;
  applicant: {
    displayName: string;
    profile: { capabilityLevel: string; reputationScore: number } | null;
    skills: Array<{ skill: { name: string }; proficiency: number }>;
  };
};

const componentLabels: Record<string, string> = {
  skills: "技能",
  capability: "能力",
  successRate: "成功率",
  similarExperience: "相似经验",
  capacity: "产能",
  reputation: "信誉",
};

export function ApplicationReviewView({
  applications,
  onDecide,
}: {
  applications: ProjectApplication[];
  onDecide: (applicationId: string, decision: ApplicationDecision) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  async function decide(application: ProjectApplication, decision: ApplicationDecision) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(application.id);
    setError("");
    try {
      await onDecide(application.id, decision);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "处理申请失败");
      return false;
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  if (!applications.length) return <div className="rounded-[28px] border border-black/10 bg-white p-12 text-center text-black/55">当前没有待处理申请</div>;

  return <div className="space-y-5">
    {error ? <p role="alert" className="rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</p> : null}
    {applications.map((application) => {
      const special = application.status === "SPECIAL_CAPABILITY_REVIEW";
      const components = application.matchingBreakdown?.components ?? {};
      return <article key={application.id} className="rounded-[28px] border border-black/10 bg-white p-6 shadow-[0_14px_40px_rgba(48,48,48,.07)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-sm font-black text-black/45">{application.applicant.profile?.capabilityLevel ?? "等级待补充"} · 信誉 {application.applicant.profile?.reputationScore ?? "—"}</p><h2 className="mt-1 text-2xl font-black">{application.applicant.displayName}</h2></div>
          <div className="text-right"><strong className="text-3xl font-black">{Number(application.matchingScore)}%</strong><p className="text-xs font-bold text-black/45">综合匹配</p></div>
        </div>
        {application.specialReviewReason ? <p className="mt-4 rounded-2xl bg-[#fff3b2] p-3 text-sm font-black">{application.specialReviewReason}</p> : null}
        <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(components).map(([key, value]) => <div key={key} className="rounded-2xl bg-[#f4f1e8] p-3"><p className="text-xs font-bold text-black/45">{componentLabels[key] ?? key}</p><strong>{Math.round(value)}%</strong></div>)}
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Fact label="申请动机" value={application.motivation} />
          <Fact label="相关经验" value={application.relevantExperience} />
          <Fact label="预计投入" value={`${application.estimatedHours} 小时`} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">{application.applicant.skills.map((item) => <span key={item.skill.name} className="rounded-full border border-black/10 px-3 py-1 text-xs font-bold">{item.skill.name} · {item.proficiency}</span>)}</div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <FeedbackButton successLabel="已提交" disabled={busy !== null} onClick={() => decide(application, "REJECTED")} className="rounded-2xl border border-black/15 px-5 py-3 font-black disabled:opacity-50">拒绝{application.applicant.displayName}</FeedbackButton>
          <SlideCommit width={340} disabled={busy !== null} label={special ? `滑动特殊批准并指派${application.applicant.displayName}` : `滑动批准并指派${application.applicant.displayName}`} doneLabel="已批准并指派" onConfirm={() => decide(application, special ? "SPECIAL_APPROVED" : "APPROVED")} />
        </div>
      </article>;
    })}
  </div>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-black text-black/45">{label}</p><p className="mt-1 text-sm leading-6">{value}</p></div>;
}
