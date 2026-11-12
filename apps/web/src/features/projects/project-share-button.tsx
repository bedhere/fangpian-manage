"use client";
import { Copy, Share2, X, Check } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal, flushSync } from "react-dom";
import { projectShareUrl } from "./project-links";

export function ProjectShareButton({
  projectId,
  title,
}: {
  projectId: string;
  title: string;
}) {
  const [open, setOpen] = useState(false),
    [url, setUrl] = useState(""),
    [copied, setCopied] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    dialog = useRef<HTMLDivElement>(null),
    generation = useRef(0);
  const close = () => {
    generation.current++;
    setOpen(false);
    setBusy(false);
  };
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    input.current?.focus();
    input.current?.select();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open]);
  async function copy(link: string) {
    const id = ++generation.current;
    setBusy(true);
    setCopied(false);
    setError("");
    let written = false;
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(link);
      written = true;
    } catch {
      /* The visible link also supports browser-native selection copying. */
    }
    if (generation.current !== id) return;
    if (input.current && typeof document.execCommand === "function") {
      input.current.focus();
      input.current.select();
      try {
        written = document.execCommand("copy") || written;
      } catch {
        /* 示例品牌 modern copy outcome. */
      }
    }
    if (written) setCopied(true);
    else {
      setError("浏览器未允许自动复制，请选中下方链接手动复制。");
      input.current?.focus();
      input.current?.select();
    }
    setBusy(false);
  }
  const keyboard = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
    if (e.key !== "Tab") return;
    const items = [
      ...(dialog.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled),input",
      ) ?? []),
    ];
    if (e.shiftKey && document.activeElement === items[0]) {
      e.preventDefault();
      items.at(-1)?.focus();
    } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
      e.preventDefault();
      items[0]?.focus();
    }
  };
  return (
    <>
      <button
        type="button"
        aria-label={`转发分享：${title}`}
        onClick={() => {
          const link = projectShareUrl(window.location.origin, projectId);
          // Mount the selectable link during the click gesture for embedded browsers.
          flushSync(() => {
            setUrl(link);
            setOpen(true);
          });
          void copy(link);
        }}
        className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-2xl border border-[#e7ddba] bg-[#fff9e7] px-4 py-3 text-sm font-bold text-[#72602b] transition hover:border-[#e6bb38] hover:bg-[#fff1b8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b88716]"
      >
        <Share2 size={16} aria-hidden="true" />
        转发分享
      </button>
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] grid place-items-center bg-black/35 p-4 backdrop-blur-sm"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            <div
              ref={dialog}
              role="dialog"
              aria-modal="true"
              aria-label="转发项目"
              onKeyDown={keyboard}
              className="w-full max-w-lg rounded-[28px] border border-black/10 bg-[#fffdf5] p-6 shadow-2xl sm:p-7"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black tracking-[.14em] text-[#8a7b50]">
                    分享项目
                  </p>
                  <h2 className="mt-2 break-words text-xl font-black">
                    {title}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label="关闭分享"
                  className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-[#f2eddf]"
                  onClick={close}
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
              <p className="mt-4 text-sm leading-6 text-[#777166]">
                把链接粘贴到群里，成员登录后即可查看项目，并在开放申请时领取任务。
              </p>
              <label className="mt-5 block text-sm font-bold">
                项目链接
                <input
                  ref={input}
                  aria-label="项目链接"
                  readOnly
                  value={url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="mt-2 w-full rounded-xl border border-black/15 bg-white px-3 py-3 text-sm outline-none focus:border-[#bd8b14] focus:ring-2 focus:ring-[#ffd85f]/30"
                />
              </label>
              {copied ? (
                <p
                  role="status"
                  className="mt-3 flex items-center gap-2 text-sm font-bold text-[#27745d]"
                >
                  <Check size={16} aria-hidden="true" />
                  链接已复制，可粘贴到群里。
                </p>
              ) : null}
              {error ? (
                <p role="alert" className="mt-3 text-sm text-[#956b12]">
                  {error}
                </p>
              ) : null}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-xl px-4 py-3 text-sm font-bold hover:bg-[#f2eddf]"
                >
                  完成
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void copy(url)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#ffd85f] px-5 py-3 text-sm font-black disabled:opacity-60"
                >
                  <Copy size={16} aria-hidden="true" />
                  {busy ? "正在复制…" : "复制链接"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
