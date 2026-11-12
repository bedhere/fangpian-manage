"use client";
import { useState } from "react";
import { AnimatedContent } from "../../components/motion/page-motion";
import {
  ProjectApplicationDialog,
  type ApplicationInput,
} from "./project-application-dialog";
export type { ApplicationInput } from "./project-application-dialog";

export type MarketProject = {
  id: string;
  title: string;
  description: string;
  projectLevel: string | null;
  estimatedHours: string | null;
  deadline: string | null;
  publisherDepartment: { name: string };
  requiredSkills: Array<{ skill: { name: string } }>;
  _count: { applications: number };
  matching: {
    score: number;
    specialReviewRequired: boolean;
    employeeLevel: number;
    requiredLevel: number;
    components: Record<string, number>;
  };
  estimatedBonus: number | null;
  applicationState: string | null;
};

type ApplyResult = { status: string };

export function MarketView({
  projects,
  onApply,
}: {
  projects: MarketProject[];
  onApply: (projectId: string, input: ApplicationInput) => Promise<ApplyResult>;
}) {
  const [selected, setSelected] = useState<MarketProject | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [projectLevel, setProjectLevel] = useState("ALL");
  const [requiredLevel, setRequiredLevel] = useState("ALL");
  const [matchType, setMatchType] = useState("ALL");
  const normalizedSearch = search.trim().toLocaleLowerCase("zh-CN");
  const visibleProjects = projects.filter((project) => {
    const searchable =
      `${project.title} ${project.description} ${project.requiredSkills.map((item) => item.skill.name).join(" ")}`.toLocaleLowerCase(
        "zh-CN",
      );
    return (
      (!normalizedSearch || searchable.includes(normalizedSearch)) &&
      (projectLevel === "ALL" || project.projectLevel === projectLevel) &&
      (requiredLevel === "ALL" ||
        `L${project.matching.requiredLevel}` === requiredLevel) &&
      (matchType === "ALL" ||
        (matchType === "SPECIAL") === project.matching.specialReviewRequired)
    );
  });

  return (
    <>
      {message ? (
        <p
          role="status"
          className="mt-6 rounded-2xl border border-black/10 bg-white p-4 font-bold"
        >
          {message}
        </p>
      ) : null}
      <section
        aria-label="市场筛选"
        className="fp-card mt-8 grid gap-3 p-4 md:grid-cols-4"
      >
        <label className="text-xs font-black text-black/50">
          搜索项目
          <input
            aria-label="搜索项目"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="标题、描述或技能"
            className="mt-2 h-11 w-full rounded-2xl border border-black/10 px-4 text-sm text-[#303030] outline-none focus:border-black"
          />
        </label>
        <FilterSelect
          label="项目等级"
          value={projectLevel}
          onChange={setProjectLevel}
          options={["P0", "P1", "P2", "P3", "P4"]}
        />
        <FilterSelect
          label="能力要求"
          value={requiredLevel}
          onChange={setRequiredLevel}
          options={["L0", "L1", "L2", "L3", "L4"]}
        />
        <label className="text-xs font-black text-black/50">
          匹配情况
          <select
            aria-label="匹配情况"
            value={matchType}
            onChange={(event) => setMatchType(event.target.value)}
            className="mt-2 h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-[#303030]"
          >
            <option value="ALL">全部</option>
            <option value="STANDARD">符合要求</option>
            <option value="SPECIAL">需特殊审核</option>
          </select>
        </label>
      </section>
      <section className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {visibleProjects.map((project, index) => (
          <AnimatedContent key={project.id} delay={Math.min(index, 4) * 45}>
            <article className="fp-card fp-glare fp-lift flex h-full min-h-96 flex-col p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-[#ffd85f] px-3 py-1 text-xs font-black text-[#303030]">
                  {project.projectLevel ?? "待定"}
                </span>
                <strong className="text-3xl font-black tracking-[-.04em] text-[#303030]">
                  {project.matching.score}
                  <small className="text-base">%</small>
                </strong>
              </div>
              <h2 className="mt-4 text-xl font-black">{project.title}</h2>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-black/60">
                {project.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {project.requiredSkills.map((item) => (
                  <span
                    key={item.skill.name}
                    className="rounded-lg bg-[#f4f1e8] px-2 py-1 text-xs font-bold"
                  >
                    {item.skill.name}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-xs font-bold text-black/55">
                能力 L{project.matching.employeeLevel} / 要求 L
                {project.matching.requiredLevel}
                {project.matching.specialReviewRequired
                  ? " · 需特殊审核"
                  : " · 符合要求"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-black/60">
                <span>
                  技能 {Math.round(project.matching.components.skills ?? 0)}%
                </span>
                <span>
                  产能 {Math.round(project.matching.components.capacity ?? 0)}%
                </span>
                <span>
                  {project.estimatedBonus === null
                    ? "奖金待核定"
                    : `预计奖金 ¥${project.estimatedBonus.toLocaleString("zh-CN")}`}
                </span>
              </div>
              <dl className="mt-auto grid grid-cols-3 gap-2 pt-6 text-sm">
                <div>
                  <dt className="text-black/50">部门</dt>
                  <dd className="mt-1 font-bold">
                    {project.publisherDepartment.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-black/50">参考工时</dt>
                  <dd className="mt-1 font-bold">
                    {project.estimatedHours ?? "—"}h
                  </dd>
                </div>
                <div>
                  <dt className="text-black/50">申请</dt>
                  <dd className="mt-1 font-bold">
                    {project._count.applications} 人
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                disabled={project.applicationState !== null}
                onClick={() => {
                  setSelected(project);
                  setMessage("");
                }}
                className="mt-5 h-11 rounded-2xl bg-[#303030] font-black text-white transition hover:bg-black focus:outline-none focus:ring-4 focus:ring-[#ffe45c] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {project.applicationState
                  ? project.applicationState === "APPROVED"
                    ? "已获批准"
                    : "申请审核中"
                  : project.matching.specialReviewRequired
                    ? "提交特殊申请"
                    : "申请承接"}
              </button>
            </article>
          </AnimatedContent>
        ))}
      </section>
      {!visibleProjects.length ? (
        <div className="mt-5 rounded-[26px] border border-black/10 bg-white p-10 text-center">
          <img
            src="/brand/tiger-side-glance.webp"
            alt=""
            className="mx-auto mb-3 h-24 w-24 object-contain"
          />
          <p className="font-bold text-black/50">没有符合当前筛选条件的项目</p>
        </div>
      ) : null}

      {selected ? (
        <ProjectApplicationDialog
          project={selected}
          onApply={onApply}
          onClose={() => setSelected(null)}
          onSuccess={(result) => {
            setMessage(
              result.status === "SPECIAL_CAPABILITY_REVIEW"
                ? "申请已提交，能力差距需独立审核"
                : "申请已提交，等待审核",
            );
            setSelected(null);
          }}
        />
      ) : null}
    </>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => unknown | Promise<unknown>;
  options: string[];
}) {
  return (
    <label className="text-xs font-black text-black/50">
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-[#303030]"
      >
        <option value="ALL">全部</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
