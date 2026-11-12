import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { type TaskDetails, type TaskProgressInput } from "../domain/types";
import { TaskDetailBody } from "./TaskDetailBody";
import { useApp } from "../store/AppProvider";

type Mode = "detail" | "progress" | "edit";
/** Details are fetched only when opened; progress history never expands the board snapshot. */
export function TaskDetail() {
  const { selectedId } = useApp();
  return selectedId ? (
    <TaskDetailContent key={selectedId} id={selectedId} />
  ) : null;
}

function TaskDetailContent({ id }: { id: string }) {
  const { select, refresh, pushToast } = useApp();
  const [data, setData] = useState<TaskDetails | null>(null);
  const [mode, setMode] = useState<Mode>("detail");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<TaskProgressInput>({
    progressPercent: 0,
    summary: "",
    nextAction: "",
    blockers: "",
    riskLevel: 0,
  });
  const [info, setInfo] = useState({ title: "", note: "" });
  const dialog = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const saving = useRef(false);
  const changeMode = (next: Mode) => {
    setMode(next);
    setError("");
  };
  const close = () => {
    if (saving.current) return;
    if (mode !== "detail") changeMode("detail");
    else select(null);
  };

  useEffect(() => {
    let active = true;
    setError("");
    api
      .get<TaskDetails>(`/api/tasks/${id}/details`)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active) setError(e.message || "详情加载失败，请重试");
      });
    return () => {
      active = false;
    };
  }, [id, retry]);

  useEffect(() => {
    mounted.current = true;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      mounted.current = false;
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  useEffect(() => {
    const target =
      mode === "detail"
        ? dialog.current?.querySelector<HTMLButtonElement>("[data-close]")
        : dialog.current?.querySelector<HTMLInputElement>("input");
    target?.focus();
  }, [mode]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
    if (e.key !== "Tab") return;
    const items = Array.from(
      dialog.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]",
      ) ?? [],
    );
    const first = items[0],
      last = items[items.length - 1];
    if (!first) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const refreshBoard = () => {
    void refresh(true).catch(() =>
      pushToast({
        title: "进展已保存",
        body: "列表暂未刷新，稍后重新打开即可查看。",
        kind: "info",
      }),
    );
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (saving.current || !data) return;
    setError("");
    if (
      mode === "progress" &&
      (!Number.isInteger(draft.progressPercent) ||
        draft.progressPercent < 0 ||
        draft.progressPercent > 100 ||
        draft.summary.trim().length < 2 ||
        draft.nextAction.trim().length < 2)
    ) {
      setError("请填写0至100的整数进度，以及至少2字的进展摘要和下一步。");
      return;
    }
    if (mode === "edit" && !info.title.trim()) {
      setError("请填写任务名称");
      return;
    }
    saving.current = true;
    setBusy(true);
    try {
      if (mode === "progress") {
        const result = await api.post<TaskDetails>(
          `/api/tasks/${id}/progress`,
          draft,
        );
        if (mounted.current) setData(result);
      } else {
        const patch = { title: info.title.trim(), note: info.note };
        await api.patch(`/api/tasks/${id}`, patch);
        if (mounted.current)
          setData({ ...data, task: { ...data.task, ...patch } });
      }
      if (mounted.current) {
        changeMode("detail");
        pushToast({
          title: mode === "progress" ? "进展已保存" : "任务信息已保存",
          body: "",
          kind: "info",
        });
        refreshBoard();
      }
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "保存失败，请重试");
    } finally {
      saving.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const claim = async () => {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      await api.post(`/api/tasks/${id}/claim`);
      const result = await api.get<TaskDetails>(`/api/tasks/${id}/details`);
      if (mounted.current) {
        setData(result);
        refreshBoard();
      }
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "认领失败，请重试");
    } finally {
      saving.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const [attachment, setAttachment] = useState<{
    name: string;
    url: string;
  } | null>(null);
  const openEvidence = async (index: number) => {
    setError("");
    setAttachment(null);
    try {
      const file = await api.get<{ name: string; url: string }>(
        `/api/tasks/${id}/evidence/${index}`,
      );
      if (mounted.current) setAttachment(file);
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "附件暂不可用");
    }
  };
  const task = data?.task;
  const heading =
    mode === "progress"
      ? "更新进度"
      : mode === "edit"
        ? "编辑任务信息"
        : "任务详情";

  return (
    <div className="task-detail-mask">
      <div
        className="task-detail-dialog"
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        onKeyDown={onKeyDown}
        aria-busy={busy}
      >
        <header className="task-detail-header">
          <div>
            <span className="task-detail-eyebrow">部门待办</span>
            <h2>{heading}</h2>
          </div>
          <button
            className="icon-btn"
            data-close
            aria-label={mode === "detail" ? "关闭任务详情" : "返回任务详情"}
            disabled={busy}
            onClick={close}
          >
            ×
          </button>
        </header>
        {error && (
          <div className="task-detail-error" role="alert">
            {error}
            {!data && (
              <button className="btn sm" onClick={() => setRetry((x) => x + 1)}>
                重新加载
              </button>
            )}
          </div>
        )}
        {!data && !error && (
          <p className="task-detail-empty" role="status">
            正在加载任务详情…
          </p>
        )}
        {data && task && (
          <>
            {mode === "detail" ? (
              <TaskDetailBody
                data={data}
                busy={busy}
                attachment={attachment}
                onEvidence={openEvidence}
                onClaim={claim}
                onProgress={() => {
                  setDraft({
                    progressPercent: task.progress,
                    summary: "",
                    nextAction: "",
                    blockers: "",
                    riskLevel: 0,
                  });
                  changeMode("progress");
                }}
                onEdit={() => {
                  setInfo({ title: task.title, note: task.note });
                  changeMode("edit");
                }}
              />
            ) : (
              <form className="task-detail-form" onSubmit={save}>
                <p className="task-detail-context">{task.title}</p>
                <fieldset disabled={busy}>
                  {mode === "progress" ? (
                    <>
                      <div>
                        <label htmlFor="task-progress-percent">
                          进度百分比
                        </label>
                        <div className="task-detail-percent">
                          <input
                            id="task-progress-percent"
                            aria-label="进度百分比"
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            required
                            value={
                              Number.isNaN(draft.progressPercent)
                                ? ""
                                : draft.progressPercent
                            }
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                progressPercent:
                                  e.target.value === ""
                                    ? NaN
                                    : Number(e.target.value),
                              })
                            }
                          />
                          <span>%</span>
                        </div>
                      </div>
                      <p className="task-detail-help">
                        100% 将标记完成，低于100%将保持进行中。
                      </p>
                      <label>
                        进展摘要
                        <textarea
                          rows={3}
                          required
                          minLength={2}
                          maxLength={4000}
                          value={draft.summary}
                            aria-label="进展摘要"
                          onChange={(e) =>
                            setDraft({ ...draft, summary: e.target.value })
                          }
                          placeholder="本次完成了什么，有哪些成果"
                        />
                      </label>
                      <label>
                        下一步
                        <textarea
                          rows={2}
                          required
                          minLength={2}
                          maxLength={4000}
                          value={draft.nextAction}
                            aria-label="下一步"
                          onChange={(e) =>
                            setDraft({ ...draft, nextAction: e.target.value })
                          }
                          placeholder="接下来要做什么"
                        />
                      </label>
                      <label>
                        阻塞事项（选填）
                        <textarea
                          rows={2}
                          maxLength={4000}
                          value={draft.blockers}
                            aria-label="阻塞事项（选填）"
                          onChange={(e) =>
                            setDraft({ ...draft, blockers: e.target.value })
                          }
                          placeholder="遇到的问题，或需要谁协助"
                        />
                      </label>
                      <label>
                        风险等级
                        <select
                          value={draft.riskLevel}
                            aria-label="风险等级"
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              riskLevel: Number(e.target.value),
                            })
                          }
                        >
                          {["无风险", "关注", "较高", "严重"].map(
                            (label, i) => (
                              <option value={i} key={i}>
                                {i} · {label}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    </>
                  ) : (
                    <>
                      <label>
                        任务名称
                        <input
                          required
                          maxLength={500}
                          value={info.title}
                            aria-label="任务名称"
                          onChange={(e) =>
                            setInfo({ ...info, title: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        任务说明
                        <textarea
                          rows={10}
                          maxLength={8000}
                          value={info.note}
                            aria-label="任务说明"
                          onChange={(e) =>
                            setInfo({ ...info, note: e.target.value })
                          }
                        />
                      </label>
                    </>
                  )}
                </fieldset>
                <footer className="task-detail-footer">
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() => changeMode("detail")}
                  >
                    取消
                  </button>
                  <button type="submit" className="btn primary" disabled={busy}>
                    {busy
                      ? "保存中…"
                      : mode === "progress"
                        ? "保存进展"
                        : "保存信息"}
                  </button>
                </footer>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
