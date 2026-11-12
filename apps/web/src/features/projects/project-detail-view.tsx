import { FeedbackButton } from "@fangpian/ui";
import { Card } from "@fangpian/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { projectStatusLabels, type ProjectDetail } from "./project-types";
import { ProjectShareButton } from "./project-share-button";

export function ProjectDetailView({
  project,
  onResubmit,
  timeline,
  claim,
}: {
  project: ProjectDetail;
  onResubmit: () => unknown | Promise<unknown>;
  timeline?: ReactNode;
  claim?: ReactNode;
}) {
  const deliveryVisible = [
    "IN_PROGRESS",
    "AT_RISK",
    "DELIVERY_SUBMITTED",
    "BUSINESS_ACCEPTANCE",
    "EXECUTIVE_CONFIRMATION",
    "CONTRIBUTION_CONFIRMATION",
  ].includes(project.status);
  const contributionVisible = [
    "CONTRIBUTION_CONFIRMATION",
    "SETTLEMENT_PENDING",
    "SETTLED",
  ].includes(project.status);
  const hasActions =
    project.allowedActions.length > 0 || deliveryVisible || contributionVisible;
  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
      <div className="space-y-5">
        <Card className="p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="rounded-full bg-[#ffd85f] px-3 py-1 text-xs font-black">
              {projectStatusLabels[project.status] ?? project.status}
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-black">V{project.version}</span>
              <ProjectShareButton
                projectId={project.id}
                title={project.title}
              />
            </div>
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-[-.04em]">
            {project.title}
          </h1>
          <p className="mt-4 leading-7 text-[#777166]">{project.description}</p>
          <div className="mt-7 grid gap-5 md:grid-cols-3">
            <Fact title="业务问题" value={project.businessProblem} />
            <Fact title="期望成果" value={project.expectedResult} />
            <Fact title="验收标准" value={project.acceptanceCriteria} />
          </div>
        </Card>
        {timeline}
        <Card className="p-7">
          <h2 className="text-2xl font-black">审核记录</h2>
          {project.approvals.length ? (
            <div className="mt-5 space-y-3">
              {project.approvals.map((approval, index) => (
                <article
                  key={approval.id ?? `${approval.stage}-${index}`}
                  className="rounded-2xl bg-white p-4"
                >
                  <strong>
                    {approval.stage} · {approval.decision}
                  </strong>
                  <p className="mt-2 text-sm text-[#777166]">
                    {approval.comment || "未填写意见"}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[#777166]">尚无审核记录</p>
          )}
        </Card>
      </div>
      <aside className="space-y-5">
        <Card className="p-6">
          <h2 className="text-xl font-black">项目参数</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <Row name="发布部门" value={project.publisherDepartment.name} />
            <Row name="发布人" value={project.publisher.displayName} />
            <Row name="项目等级" value={project.projectLevel ?? "待定"} />
            <Row
              name="能力要求"
              value={project.requiredCapabilityLevel ?? "待定"}
            />
            <Row name="预计工时" value={project.estimatedHours ?? "待定"} />
            <Row name="批准工时" value={project.approvedHours ?? "待定"} />
          </dl>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-black">可执行操作</h2>
          <div className="mt-5 space-y-3">
            {claim}
            {project.allowedActions.includes("RESUBMIT") ? (
              <FeedbackButton
                successLabel="已提交"
                onClick={onResubmit}
                className="w-full rounded-2xl bg-[#303030] px-5 py-3 font-black text-white"
              >
                重新提交审核
              </FeedbackButton>
            ) : null}
            {project.allowedActions.includes("REVIEW_APPLICATIONS") ? (
              <Link
                href={`/projects/${project.id}/applications`}
                className="block w-full rounded-2xl bg-[#ffd85f] px-5 py-3 text-center font-black"
              >
                查看并比较申请人
              </Link>
            ) : null}
            {project.allowedActions.includes("PLAN_PROJECT") ? (
              <Link
                href={`/projects/${project.id}/plan`}
                className="block w-full rounded-2xl bg-[#303030] px-5 py-3 text-center font-black text-white"
              >
                编辑执行计划
              </Link>
            ) : null}
            {project.allowedActions.includes("MANAGE_EXECUTION") ? (
              <Link
                href={`/projects/${project.id}/manage`}
                className="block w-full rounded-2xl bg-[#ffd85f] px-5 py-3 text-center font-black"
              >
                进入执行驾驶舱
              </Link>
            ) : null}
            {deliveryVisible ? (
              <Link
                href={`/projects/${project.id}/delivery`}
                className="block w-full rounded-2xl bg-[#303030] px-5 py-3 text-center font-black text-white"
              >
                进入交付与验收
              </Link>
            ) : null}
            {contributionVisible ? (
              <Link
                href={`/projects/${project.id}/contributions`}
                className="block w-full rounded-2xl bg-[#ffd85f] px-5 py-3 text-center font-black"
              >
                贡献确认与争议
              </Link>
            ) : null}
            {!hasActions && !claim ? (
              <p className="text-sm text-[#777166]">
                当前没有需要你处理的操作。
              </p>
            ) : null}
          </div>
        </Card>
      </aside>
    </div>
  );
}

function Fact({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <h2 className="font-black">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#777166]">{value}</p>
    </div>
  );
}
function Row({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[#777166]">{name}</dt>
      <dd className="font-black">{value}</dd>
    </div>
  );
}
