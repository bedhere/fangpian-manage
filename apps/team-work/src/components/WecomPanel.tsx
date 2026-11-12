import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { api } from "../api/client";
import { useApp } from "../store/AppProvider";

type Field = { field_id: string; field_title: string; field_type: string };
type Choice = {
  recordId: string;
  action: "create" | "bind" | "update";
  taskId?: string;
  project?: string;
};
type Row = {
  recordId: string;
  taskId?: string;
  title: string;
  project: string;
  department?: string;
  departmentId?: string | null;
  ownerName: string;
  progress?: number;
  sourceStatus?: string;
  conflict?: boolean;
  warnings?: string[];
  error?: string;
  boundTaskId?: string | null;
  candidates?: Array<{
    id: string;
    title: string;
    project: string;
    progress: number | null;
  }>;
  changes?: Record<string, unknown>;
  before?: Record<string, unknown>;
  blocked?: string;
};
type Preview = {
  previewId: string;
  mode: "import" | "export";
  documentName: string;
  sheetTitle: string;
  readonly: boolean;
  fields: Field[];
  mapping: Record<string, string>;
  departmentMap: Record<string, string>;
  platformDepartments: Array<{ id: string; name: string }>;
  departments?: string[];
  rows: Row[];
  skipped?: number;
};
type Status = {
  authorized: boolean;
  canImport: boolean;
  documentName: string;
  url: string;
};
const root = "/api/team-work/tasks/wecom";
const mappingLabels: Record<string, string> = {
  title: "任务标题",
  project: "项目名称",
  department: "部门",
  owner: "负责人",
  helpers: "协助人",
  priority: "优先级",
  progress: "进度",
  status: "状态",
  start: "开始日期",
  due: "截止日期",
  note: "进度结果",
};
const fieldTypes: Record<string, string[]> = {
  title: ["text"],
  project: ["text"],
  department: ["text", "single_select", "select"],
  owner: ["user"],
  helpers: ["user"],
  priority: ["text", "single_select"],
  progress: ["progress", "percentage"],
  status: ["text", "single_select"],
  start: ["date_time"],
  due: ["date_time"],
  note: ["text"],
};
const valueText = (value: unknown): string =>
  value == null
    ? "未填写"
    : Array.isArray(value)
      ? value.map((v) => v.text ?? v.userName ?? "").join("、")
      : String(value);

/** Background jobs prevent a slow document read from looking like a failed write. */
async function operation<T>(name: string, body: unknown): Promise<T> {
  const response = await api.post<T & { jobId?: string }>(
    `${root}/${name}`,
    body,
  );
  if (!response.jobId) return response;
  const until = Date.示例公司有限公司() + 3 * 60 * 1000;
  while (Date.示例公司有限公司() < until) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const job = await api.get<{ state: string; result: T; error?: string }>(
      `${root}/jobs/${response.jobId}`,
    );
    if (job.state === "done") return job.result;
    if (job.state === "error") throw new Error(job.error || "连接失败，请重试");
  }
  throw new Error("连接操作仍未确认，请重新读取核对，勿重复提交写回");
}

export function WecomPanel({ onClose }: { onClose: () => void }) {
  const { refresh } = useApp();
  const [status, setStatus] = useState<Status | null>(null),
    [url, setUrl] = useState(""),
    [mode, setMode] = useState<"import" | "export">("export");
  const [preview, setPreview] = useState<Preview | null>(null),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [departmentMap, setDepartmentMap] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [choices, setChoices] = useState<Record<string, Choice>>({});
  const [search, setSearch] = useState(""),
    [department, setDepartment] = useState(""),
    [busy, setBusy] = useState("连接中…"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const saving = useRef(false),
    mounted = useRef(true),
    dialog = useRef<HTMLDivElement>(null);
  const close = () => {
    if (!saving.current) onClose();
  };
  useEffect(() => {
    mounted.current = true;
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    api
      .get<Status>(`${root}/status`)
      .then((value) => {
        if (!mounted.current) return;
        setStatus(value);
        setUrl(value.url);
        setMode(value.canImport ? "import" : "export");
      })
      .catch((e) => {
        if (mounted.current) setError(e.message);
      })
      .finally(() => {
        if (mounted.current) setBusy("");
      });
    return () => {
      mounted.current = false;
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  const changeMapping = (next: Record<string, string>) => {
    setMapping(next);
    setDirty(true);
    setSelected(new Set());
    setNotice("");
  };
  const load = async () => {
    if (saving.current) return;
    saving.current = true;
    setBusy("正在读取在线文档…");
    setError("");
    setNotice("");
    try {
      const p = await operation<Preview>("preview", {
        mode,
        ...(url ? { url } : {}),
        ...(Object.keys(mapping).length ? { mapping } : {}),
        departmentMap,
      });
      if (!mounted.current) return;
      setPreview(p);
      setMapping(p.mapping);
      setDepartmentMap(p.departmentMap);
      setDirty(false);
      setSelected(new Set());
      setChoices(
        Object.fromEntries(
          p.rows.map((row) => {
            const taskId =
              row.boundTaskId ||
              (row.candidates?.length === 1 ? row.candidates[0].id : undefined);
            return [
              row.recordId,
              {
                recordId: row.recordId,
                action: taskId ? "bind" : "create",
                ...(taskId ? { taskId } : {}),
                project: row.project,
              },
            ];
          }),
        ),
      );
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      saving.current = false;
      if (mounted.current) setBusy("");
    }
  };
  const eligible = (row: Row) => {
    if (dirty || !preview || preview.mode !== mode) return false;
    if (mode === "export")
      return (
        !row.blocked && !!row.changes && Object.keys(row.changes).length > 0
      );
    const choice = choices[row.recordId];
    return (
      !row.error &&
      !row.warnings?.some((w) => w.includes("回收站")) &&
      !!choice &&
      (choice.action === "create"
        ? !!row.departmentId && !row.boundTaskId && !row.candidates?.length
        : !!choice.taskId)
    );
  };
  const rows = (preview?.mode === mode ? preview.rows : []).filter(
    (row) =>
      (!department || row.department === department) &&
      (!search ||
        `${row.title} ${row.project} ${row.ownerName} ${row.department ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  const toggle = (id: string) =>
    setSelected((old) => {
      const next = new Set(old);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const commit = async () => {
    if (saving.current || !preview || dirty || !selected.size) return;
    saving.current = true;
    setBusy(mode === "import" ? "正在导入 / 关联…" : "正在写回并验证…");
    setError("");
    setNotice("");
    try {
      const result =
        mode === "import"
          ? await operation<{
              created: number;
              linked: number;
              updated: number;
            }>("import", {
              previewId: preview.previewId,
              choices: preview.rows
                .filter((r) => selected.has(r.recordId))
                .map((r) => choices[r.recordId]),
            })
          : await operation<{ verified: number; failed: number }>("export", {
              previewId: preview.previewId,
              taskIds: preview.rows
                .filter((r) => selected.has(r.recordId))
                .map((r) => r.taskId),
            });
      if (!mounted.current) return;
      setSelected(new Set());
      setPreview(null);
      setNotice(
        "created" in result
          ? `新增${result.created}条，关联${result.linked}条，更新${result.updated}条。`
          : `已写回并回读验证${result.verified}条${result.failed ? `；${result.failed}条未确认，请重新读取核对` : ""}。`,
      );
      await refresh(true);
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      saving.current = false;
      if (mounted.current) setBusy("");
    }
  };
  const keyboard = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
    if (e.key !== "Tab") return;
    const items = [
      ...(dialog.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,[href]",
      ) || []),
    ].filter((el) => el.getClientRects().length);
    if (!items.length) return;
    if (
      e.shiftKey &&
      (document.activeElement === items[0] ||
        document.activeElement === dialog.current)
    ) {
      e.preventDefault();
      items.at(-1)?.focus();
    } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
      e.preventDefault();
      items[0].focus();
    }
  };
  return createPortal(
    <div
      className="wecom-mask"
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) close();
      }}
    >
      <div
        className="wecom-panel"
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="示例品牌在线表格"
        onKeyDown={keyboard}
      >
        <header className="wecom-heading">
          <div>
            <h2>示例品牌在线表格</h2>
            <p>直接读取任务，并将选中任务的进度与状态写回原表。</p>
          </div>
          <button
            className="icon-btn"
            aria-label="关闭示例品牌面板"
            onClick={close}
            disabled={!!busy}
          >
            ×
          </button>
        </header>
        {status && (
          <div className="wecom-target">
            <strong>{status.documentName}</strong>
            <span
              className={
                status.authorized ? "wecom-connected" : "wecom-warning"
              }
            >
              {status.authorized ? "已授权连接" : "授权已失效，请重新扫码"}
            </span>
            {preview && <span>内部工作表：{preview.sheetTitle}</span>}
          </div>
        )}
        <div className="wecom-connect-row">
          <label>
            文档链接
            <input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setDirty(true);
                setSelected(new Set());
              }}
              disabled={!!busy || !status?.canImport}
              placeholder="示例品牌智能表格链接"
            />
          </label>
          <button
            className="btn primary"
            onClick={() => void load()}
            disabled={!!busy || !status?.authorized}
          >
            读取预览
          </button>
        </div>
        <div className="wecom-controls">
          <div className="seg sm">
            {status?.canImport && (
              <button
                className={`seg-btn${mode === "import" ? " is-on" : ""}`}
                disabled={!!busy}
                onClick={() => {
                  setMode("import");
                  setSelected(new Set());
                  setNotice("");
                }}
              >
                从企微导入
              </button>
            )}
            <button
              className={`seg-btn${mode === "export" ? " is-on" : ""}`}
              disabled={!!busy}
              onClick={() => {
                setMode("export");
                setSelected(new Set());
                setNotice("");
              }}
            >
              写回企微
            </button>
          </div>
          <span className="wecom-help">
            {mode === "import"
              ? "勾选后再导入。关联旧任务可保留平台数据；未填负责人待分配。"
              : "写回已关联具体任务的进度与状态，每次最多100条。"}
          </span>
        </div>
        {preview && status?.canImport && mode === "import" && (
          <details className="wecom-mappings">
            <summary>字段与部门映射</summary>
            <div className="wecom-mapping-grid">
              {Object.entries(mappingLabels).map(([key, label]) => (
                <label key={key}>
                  {label}字段
                  <select
                    aria-label={`${label}字段`}
                    value={mapping[key] ?? ""}
                    disabled={!!busy}
                    onChange={(e) =>
                      changeMapping({ ...mapping, [key]: e.target.value })
                    }
                  >
                    <option value="">
                      {key === "title" ? "请选择" : "不导入此字段"}
                    </option>
                    {preview.fields
                      .filter((f) => fieldTypes[key]?.includes(f.field_type))
                      .map((f) => (
                        <option key={f.field_id} value={f.field_id}>
                          {f.field_title}
                        </option>
                      ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="wecom-mapping-grid">
              {preview.departments?.map((name) => (
                <label key={name}>
                  原表“{name || "未填部门"}”归属
                  <select
                    value={departmentMap[name] ?? ""}
                    disabled={!!busy}
                    onChange={(e) => {
                      setDepartmentMap({
                        ...departmentMap,
                        [name]: e.target.value,
                      });
                      setDirty(true);
                      setSelected(new Set());
                    }}
                  >
                    <option value="">按同名部门 / 主执行人归属</option>
                    {preview.platformDepartments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </details>
        )}
        {dirty && preview && (
          <p className="wecom-warning">映射已更改，请重新读取预览。</p>
        )}
        {error && (
          <p className="wecom-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="wecom-result" role="status">
            {notice}
          </p>
        )}
        {busy && (
          <p className="wecom-loading" aria-live="polite">
            {busy}
          </p>
        )}
        {preview && preview.mode === mode && (
          <>
            <div className="wecom-filters">
              <input
                aria-label="搜索在线任务"
                placeholder="搜索任务、项目、负责人"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {mode === "import" && (
                <select
                  aria-label="筛选在线部门"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                >
                  <option value="">全部部门</option>
                  {preview.departments?.map((d) => (
                    <option key={d} value={d}>
                      {d || "未填部门"}
                    </option>
                  ))}
                </select>
              )}
              <button
                className="btn ghost sm"
                disabled={!!busy || dirty}
                onClick={() =>
                  setSelected((old) => {
                    const next = new Set(old);
                    rows.filter(eligible).forEach((r) => next.add(r.recordId));
                    return next;
                  })
                }
              >
                全选当前筛选
              </button>
              <button
                className="btn ghost sm"
                disabled={!!busy}
                onClick={() => setSelected(new Set())}
              >
                清空选择
              </button>
              <span>
                {rows.length}条
                {preview.skipped ? ` · 已忽略${preview.skipped}个空标题行` : ""}
              </span>
            </div>
            <div className="wecom-table-scroll">
              <table className="wecom-table">
                <thead>
                  <tr>
                    <th>选择</th>
                    <th>任务 / 项目</th>
                    <th>执行人 / 部门</th>
                    <th>
                      {mode === "import" ? "原表进度 / 状态" : "写回差异"}
                    </th>
                    <th>
                      {mode === "import" ? "导入方式 / 核对提示" : "核对提示"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.recordId}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`选择${row.title}`}
                          checked={selected.has(row.recordId)}
                          disabled={!!busy || !eligible(row)}
                          onChange={() => toggle(row.recordId)}
                        />
                      </td>
                      <td>
                        <strong>{row.title}</strong>
                        {mode === "import" ? (
                          <label className="wecom-project">
                            所属项目
                            <input
                              aria-label={`所属项目：${row.title}`}
                              value={
                                choices[row.recordId]?.project ?? row.project
                              }
                              placeholder="未填写，独立待办"
                              disabled={!!busy}
                              onChange={(e) =>
                                setChoices({
                                  ...choices,
                                  [row.recordId]: {
                                    ...choices[row.recordId],
                                    project: e.target.value,
                                  },
                                })
                              }
                            />
                          </label>
                        ) : (
                          <small>{row.project || "独立待办"}</small>
                        )}
                      </td>
                      <td>
                        {row.ownerName}
                        <small>{row.department || ""}</small>
                      </td>
                      <td>
                        {mode === "import" ? (
                          <>
                            {row.progress === undefined
                              ? "未填写"
                              : `${row.progress}%`}
                            <small>
                              {row.sourceStatus || "未填状态"}
                              {row.conflict ? " · 待核对" : ""}
                            </small>
                          </>
                        ) : (
                          Object.entries(row.changes ?? {}).map(
                            ([id, value]) => (
                              <div key={id}>
                                {
                                  preview.fields.find((f) => f.field_id === id)
                                    ?.field_title
                                }
                                : {valueText(row.before?.[id])} →{" "}
                                <b>{valueText(value)}</b>
                              </div>
                            ),
                          )
                        )}
                      </td>
                      <td>
                        {mode === "import" ? (
                          <>
                            {(!!row.boundTaskId ||
                              !!row.candidates?.length) && (
                              <>
                                <select
                                  aria-label={`关联任务：${row.title}`}
                                  disabled={!!busy}
                                  value={choices[row.recordId]?.taskId ?? ""}
                                  onChange={(e) => {
                                    setChoices({
                                      ...choices,
                                      [row.recordId]: {
                                        ...choices[row.recordId],
                                        action: "bind",
                                        taskId: e.target.value,
                                      },
                                    });
                                    setSelected((old) => {
                                      const next = new Set(old);
                                      next.delete(row.recordId);
                                      return next;
                                    });
                                  }}
                                >
                                  <option value="">选择匹配的旧任务</option>
                                  {row.boundTaskId &&
                                    !row.candidates?.some(
                                      (t) => t.id === row.boundTaskId,
                                    ) && (
                                      <option value={row.boundTaskId}>
                                        当前已关联任务
                                      </option>
                                    )}
                                  {row.candidates?.map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {t.project} / {t.progress ?? "未填"}%
                                    </option>
                                  ))}
                                </select>
                                <select
                                  aria-label={`导入方式：${row.title}`}
                                  value={
                                    choices[row.recordId]?.action ?? "bind"
                                  }
                                  disabled={!!busy}
                                  onChange={(e) =>
                                    setChoices({
                                      ...choices,
                                      [row.recordId]: {
                                        ...choices[row.recordId],
                                        action: e.target
                                          .value as Choice["action"],
                                      },
                                    })
                                  }
                                >
                                  <option value="bind">
                                    仅关联，保留平台数据
                                  </option>
                                  <option value="update">
                                    用在线数据更新此任务
                                  </option>
                                </select>
                              </>
                            )}
                            {!row.boundTaskId && !row.candidates?.length && (
                              <span>新增任务</span>
                            )}
                            {row.error && (
                              <small className="wecom-error">{row.error}</small>
                            )}
                            {!row.departmentId && !row.candidates?.length && (
                              <small className="wecom-warning">
                                请先映射部门并重新预览
                              </small>
                            )}
                            {row.warnings?.map((w) => (
                              <small className="wecom-warning" key={w}>
                                {w}
                              </small>
                            ))}
                          </>
                        ) : (
                          <span className={row.blocked ? "wecom-warning" : ""}>
                            {row.blocked ||
                              (!Object.keys(row.changes ?? {}).length
                                ? "与原表一致，无需写回"
                                : "可写回，提交前再次核对")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && (
                <p className="wecom-empty">
                  {mode === "export"
                    ? "暂无已关联的可见任务。请组织管理员先从在线表格预览并关联已有任务。"
                    : "当前筛选下没有任务。"}
                </p>
              )}
            </div>
          </>
        )}
        {!preview && !busy && !notice && (
          <div className="wecom-empty">
            点击“读取预览”核对任务。读取不会更改平台或在线表格。
          </div>
        )}
        <footer className="wecom-footer">
          <span>
            {selected.size}条已选{preview?.readonly ? " · 原表只读" : ""}
          </span>
          <button className="btn ghost" onClick={close} disabled={!!busy}>
            关闭
          </button>
          <button
            className="btn primary"
            disabled={
              !!busy || !selected.size || dirty || preview?.mode !== mode
            }
            onClick={() => void commit()}
          >
            {mode === "import"
              ? `确认导入 / 关联（${selected.size}）`
              : `确认写回（${selected.size}）`}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
