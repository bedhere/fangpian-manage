import type { TaskDetails } from "../domain/types";
import { priorityMeta } from "../domain/types";
import { useApp } from "../store/AppProvider";

const riskLabels = ["无风险", "关注", "较高", "严重"];
const dateLabel = (value?: string | null, withTime = false) =>
  value
    ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value).toLocaleString(
        "zh-CN",
        withTime
          ? {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            }
          : { year: "numeric", month: "2-digit", day: "2-digit" },
      )
    : "未设置";

export function TaskDetailBody({
  data,
  busy,
  onProgress,
  onEdit,
  onClaim,
  onEvidence,
  attachment,
}: {
  data: TaskDetails;
  busy: boolean;
  onProgress: () => void;
  onEdit: () => void;
  onClaim: () => void;
  onEvidence: (index: number) => void;
  attachment: { name: string; url: string } | null;
}) {
  const { org, select } = useApp();
  const task = data.task;
  const name = (id: string | null) =>
    org.users.find((u) => u.id === id)?.name || (id ? "成员" : "待认领");
  return (
    <div className="task-detail-body">
      {data.parent && (
        <button
          className="task-detail-parent"
          onClick={() => select(data.parent!.id)}
        >
          所属主任务 · {data.parent.title} ↗
        </button>
      )}
      <h3 className="task-detail-title">{task.title}</h3>
      <div className="task-detail-badges">
        <span className="chip">
          {task.status === "done"
            ? "已完成"
            : task.sourceStatus && task.sourceStatus !== '待核对'
              ? task.sourceStatus
              : task.progress > 0 ? "进行中" : "未开始"}
        </span>
        <span className={`chip is-plain priority-badge priority-${task.priority}`}>
          优先级 {priorityMeta(task.priority).label}
        </span>
        {task.importSource && (
          <span className="chip is-plain">
            表格导入
            {task.importSource.row
              ? ` · 第${task.importSource.row}行`
              : " · 汇总任务"}
          </span>
        )}
      </div>
      {(task.progressConflict || (task.status === "done" && task.progress < 100) ||
        task.sourceStatus === "待核对") && (
        <p className="task-detail-notice">
          原表状态与进度存在冲突，当前保留原值，请核对后再更新。
        </p>
      )}
      <section className="task-detail-progress">
        <div>
          <strong>{task.progressUnspecified && !data.children.length && !task.importSource?.group ? '未填' : `${task.progress}%`}</strong>
          <span>
            {task.progressUnspecified
              ? data.children.length || task.importSource?.group
                ? "子任务中有未填写的进度"
                : "原表未填写进度，等待执行人更新"
              : data.children.length || task.importSource?.group
                ? "子任务汇总进度"
                : "当前进度"}
          </span>
        </div>
        <progress value={task.progress} max="100" aria-label="当前进度" />
        {data.permissions.progressHint && (
          <p>{data.permissions.progressHint}</p>
        )}
        <div className="task-detail-actions">
          {data.permissions.canUpdateProgress && (
            <button className="btn primary" onClick={onProgress}>
              更新进度
            </button>
          )}
          {data.permissions.canClaim && (
            <button className="btn primary" disabled={busy} onClick={onClaim}>
              {busy ? "认领中…" : "认领任务"}
            </button>
          )}
          {data.permissions.canEdit && (
            <button className="btn" onClick={onEdit}>
              编辑任务信息
            </button>
          )}
        </div>
      </section>
      <dl className="task-detail-fields">
        <div>
          <dt>执行人</dt>
          <dd>
            {task.importSource?.group
              ? "由子任务执行人分别负责"
              : task.assignmentPending ? '待分配' : name(task.ownerId)}
          </dd>
        </div>
        <div>
          <dt>派发来源</dt>
          <dd>{task.importSource ? "表格导入" : name(task.creatorId)}</dd>
        </div>
        <div>
          <dt>开始日期</dt>
          <dd>{dateLabel(task.startAt)}</dd>
        </div>
        <div>
          <dt>截止日期</dt>
          <dd>{dateLabel(task.dueAt)}</dd>
        </div>
        <div>
          <dt>板块 / 类型</dt>
          <dd>
            {task.category || "未分类"} / {task.type || "未设置"}
          </dd>
        </div>
        <div>
          <dt>完成时间</dt>
          <dd>
            {task.doneAt
              ? dateLabel(task.doneAt, true)
              : task.status === "done"
                ? "原始记录未提供"
                : "尚未完成"}
          </dd>
        </div>
      </dl>
      <section className="task-detail-section">
        <h4>任务说明</h4>
        <p className="task-detail-note">
          {task.note || "暂无任务说明，可在编辑任务信息中补充。"}
        </p>
      </section>
      {!!task.evidence?.length && (
        <section className="task-detail-section">
          <h4>相关附件</h4>
          <div className="task-detail-files">
            {task.evidence.map((file, i) => (
              <button
                key={i}
                className="btn sm"
                onClick={() => void onEvidence(i)}
              >
                {file.name}
              </button>
            ))}
          </div>
          {attachment && (
            <a
              className="task-detail-parent"
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              打开附件：{attachment.name} ↗
            </a>
          )}
        </section>
      )}
      {!!data.children.length && (
        <section className="task-detail-section">
          <h4>
            子任务 <span>{data.children.length}</span>
          </h4>
          <ul className="task-detail-children">
            {data.children.map((child) => (
              <li key={child.id}>
                <button onClick={() => select(child.id)}>
                  <span>{child.title}</span>
                  <em>
                    {child.progressUnspecified
                      ? "原表未填"
                      : `${child.progress}%`}{" "}
                    ↗
                  </em>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="task-detail-section">
        <h4>
          进展记录 <span>{data.updates.length}</span>
        </h4>
        {!data.updates.length ? (
          <p className="task-detail-empty">
            暂无进展记录。原有任务数据已保留，新提交的进展会显示在这里。
          </p>
        ) : (
          <ol className="task-detail-timeline">
            {data.updates.map((item) => (
              <li key={item.id}>
                <div className="task-detail-log-head">
                  <strong>{item.authorName}</strong>
                  <time dateTime={item.createdAt}>
                    {dateLabel(item.createdAt, true)}
                  </time>
                  <span className="chip">{item.progressPercent}%</span>
                </div>
                <p className="task-detail-note">{item.summary}</p>
                <p className="task-detail-note">
                  <b>下一步：</b>
                  {item.nextAction}
                </p>
                {item.blockers && (
                  <p className="task-detail-note">
                    <b>阻塞事项：</b>
                    {item.blockers}
                  </p>
                )}
                <span
                  className={`task-detail-risk${item.riskLevel ? " has-risk" : ""}`}
                >
                  风险等级：{riskLabels[item.riskLevel]}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
