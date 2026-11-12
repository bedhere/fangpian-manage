import { Card } from "@fangpian/ui";
import Link from "next/link";
import { projectStatusLabels, type ProjectSummary } from "./project-types";
import { ProjectShareButton } from "./project-share-button";

export function ProjectListView({
  projects,
  total,
  owned = false,
  department = false,
}: {
  projects: ProjectSummary[];
  total: number;
  owned?: boolean;
  department?: boolean;
}) {
  if (!projects.length)
    return (
      <section>
        <h1 className="mb-5 text-4xl font-black">
          {department ? "部门项目" : owned ? "我推进的项目" : "项目中心"}
        </h1>
        <Card className="p-10 text-center">
          <img
            src="/brand/tiger-reading-standing.webp"
            alt=""
            className="fp-float mx-auto mb-4 h-28 w-28 object-contain"
          />
          <h2 className="text-xl font-black">
            {department
              ? "本部门暂无进行中的项目"
              : owned
                ? "还没有接取的项目"
                : "暂无项目"}
          </h2>
          <p className="mt-2 text-sm text-[#777166]">
            {department
              ? "这里只显示当前所属部门尚未结束的项目。"
              : owned
                ? "接取项目并被指定为负责人后，这里会显示你负责的项目及完整进度时间轴。"
                : "发起需求或调整筛选后，项目会显示在这里。"}
          </p>
          {owned ? (
            <>
              <p className="mt-2 text-sm text-[#777166]">
                已发起但仍在审核中的项目，可从项目详情查看时间轴。
              </p>
              <Link
                href="/projects"
                className="mt-5 inline-flex rounded-2xl bg-[#ffd85f] px-5 py-3 font-black hover:shadow-[0_12px_28px_rgba(255,216,95,.4)]"
              >
                查看我发起或参与的项目
              </Link>
            </>
          ) : null}
        </Card>
      </section>
    );
  return (
    <section>
      <div className="mb-5 flex items-end justify-between">
        <div>
          <p className="text-xs font-black tracking-[.2em] text-[#8a7b50]">
            PROJECTS
          </p>
          <h1 className="mt-2 text-4xl font-black">
            {department ? "部门项目" : owned ? "我推进的项目" : "项目中心"}
          </h1>
        </div>
        <span className="rounded-full bg-[#ffd85f] px-4 py-2 text-sm font-black">
          共 {total} 项
        </span>
      </div>
      <div className="fp-stagger grid gap-4 lg:grid-cols-2">
        {projects.map((project) => (
          <Card key={project.id} className="fp-lift p-6">
            <div className="flex items-center justify-between gap-4">
              <span className="rounded-full bg-[#fff1b8] px-3 py-1 text-xs font-black">
                {projectStatusLabels[project.status] ?? project.status}
              </span>
              <span className="text-xs text-[#777166]">
                {project.projectLevel ?? "待定级"}
              </span>
            </div>
            <h2 className="mt-5 text-2xl font-black">{project.title}</h2>
            <p className="mt-3 text-sm text-[#777166]">
              {project.publisherDepartment.name} ·{" "}
              {project.publisher.displayName}
            </p>
            <p className="mt-1 text-sm text-[#777166]">
              负责人：{project.owner?.displayName ?? "待确定"}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={
                    owned
                      ? `/projects/${project.id}/manage`
                      : `/projects/${project.id}`
                  }
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#303030] px-5 py-3 text-sm font-black text-white hover:bg-black"
                >
                  {owned ? "查看完整进度时间轴" : "查看项目"}
                  <span className="fp-arrow text-[#ffd85f]" aria-hidden="true">
                    →
                  </span>
                </Link>
                {owned ? (
                  <Link
                    href={"/projects/" + project.id}
                    className="text-sm font-bold underline-offset-4 hover:underline"
                  >
                    项目详情
                  </Link>
                ) : null}
              </div>
              <ProjectShareButton
                projectId={project.id}
                title={project.title}
              />
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
