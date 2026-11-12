"use client";
import { useRef, useState } from "react";
import { apiClient } from "@/lib/api";
import {
  ProjectApplicationDialog,
  type ApplicationInput,
} from "../market/project-application-dialog";
import type { MarketProject } from "../market/market-view";

export function ProjectClaimButton({
  projectId,
  title,
  status,
}: {
  projectId: string;
  title: string;
  status: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [applicationState, setApplicationState] = useState<string | null>(null),
    [selected, setSelected] = useState<MarketProject | null>(null);
  const opening = useRef(false);
  const open = ["PUBLISHED", "APPLICATION_OPEN"].includes(status);
  async function show() {
    if (opening.current || applicationState) return;
    opening.current = true;
    setBusy(true);
    setError("");
    try {
      const search = Array.from(title).slice(0, 50).join("");
      const projects = await apiClient.request<MarketProject[]>(
        `/api/market/projects?search=${encodeURIComponent(search)}`,
      );
      const project = projects.find((p) => p.id === projectId);
      if (!project)
        throw new Error("项目当前未开放申请，请刷新详情核对最新状态。");
      if (project.applicationState) {
        setApplicationState(project.applicationState);
        setMessage(
          project.applicationState === "APPROVED"
            ? "你已获批准，可按项目安排推进。"
            : "已有申请正在审核，请勿重复提交。",
        );
      } else setSelected(project);
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法读取申请信息，请重试");
    } finally {
      opening.current = false;
      setBusy(false);
    }
  }
  const apply = (id: string, input: ApplicationInput) =>
    apiClient.request<{ status: string }>(`/api/projects/${id}/apply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  if (!open)
    return (
      <p className="text-sm leading-6 text-[#777166]">
        {[
          "HUMAN_REQUIRED",
          "DEPARTMENT_REVIEW",
          "TECH_REVIEW",
          "DRAFT",
          "AI_TRIAGE",
        ].includes(status)
          ? "项目审核中，开放申请后可在此领取任务。"
          : ["OWNER_ASSIGNED", "PLANNING", "IN_PROGRESS", "AT_RISK"].includes(
                status,
              )
            ? "项目已确定负责人，按现有项目安排推进。"
            : "项目当前未开放申请。"}
      </p>
    );
  return (
    <div>
      <button
        type="button"
        disabled={busy || !!applicationState}
        onClick={() => void show()}
        className="w-full rounded-2xl bg-[#ffd85f] px-5 py-3 font-black disabled:opacity-60"
      >
        {busy
          ? "正在读取申请信息…"
          : applicationState
            ? applicationState === "APPROVED"
              ? "已获批准"
              : "申请审核中"
            : "领取任务"}
      </button>
      <p className="mt-2 text-xs leading-5 text-[#777166]">
        填写申请后提交，沿用现有资格和审核规则。
      </p>
      {message ? (
        <p className="mt-3 text-sm text-[#27745d]" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-[#b44335]" role="alert">
          {error}
        </p>
      ) : null}
      {selected ? (
        <ProjectApplicationDialog
          project={selected}
          onApply={apply}
          onClose={() => setSelected(null)}
          onSuccess={(result) => {
            setApplicationState(result.status);
            setSelected(null);
            setMessage(
              result.status === "SPECIAL_CAPABILITY_REVIEW"
                ? "申请已提交，能力差距需独立审核"
                : "申请已提交，等待审核",
            );
          }}
        />
      ) : null}
    </div>
  );
}
