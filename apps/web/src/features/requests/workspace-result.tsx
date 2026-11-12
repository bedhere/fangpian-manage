"use client";

import { Check, Copy, Download, ExternalLink, Monitor, RotateCw, Smartphone } from "lucide-react";
import { Fragment, useMemo, useState, type ReactNode } from "react";

export type WorkspaceDemo = { title: string; html: string };
export type WorkspaceResult = { title?: string; content?: string; demo?: WorkspaceDemo; [key: string]: unknown };

/** Reads the structured result the server attached to an assistant message, if any. */
export function readResult(metadata: { result?: Record<string, unknown> } | null | undefined): WorkspaceResult | null {
  const result = metadata?.result;
  if (!result || typeof result !== "object") return null;
  const demo = result.demo as Partial<WorkspaceDemo> | undefined;
  return {
    ...result,
    title: typeof result.title === "string" ? result.title : undefined,
    content: typeof result.content === "string" ? result.content : fallbackContent(result),
    demo: demo && typeof demo.html === "string" ? { title: typeof demo.title === "string" ? demo.title : "Demo", html: demo.html } : undefined,
  };
}

/** Older results were free-form objects; show them as readable text rather than hiding them. */
function fallbackContent(result: Record<string, unknown>): string | undefined {
  const entries = Object.entries(result).filter(([key]) => key !== "demo" && key !== "title");
  if (!entries.length) return undefined;
  return entries.map(([key, value]) => `**${key}**\n${typeof value === "string" ? value : JSON.stringify(value, null, 2)}`).join("\n\n");
}

function inline(text: string): ReactNode[] {
  // **bold** and `code`; everything else stays plain text (no HTML is ever injected).
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

/** A small, safe Markdown renderer for AI deliverables: headings, lists, quotes, code blocks, tables. */
export function ResultBody({ content }: { content: string }) {
  const blocks = useMemo(() => {
    const lines = content.replace(/\r\n/g, "\n").split("\n");
    const out: ReactNode[] = [];
    let index = 0;
    while (index < lines.length) {
      const line = lines[index];
      if (line.startsWith("```")) {
        const code: string[] = [];
        index += 1;
        while (index < lines.length && !lines[index].startsWith("```")) { code.push(lines[index]); index += 1; }
        index += 1;
        out.push(<pre key={out.length}><code>{code.join("\n")}</code></pre>);
        continue;
      }
      const heading = /^(#{1,4})\s+(.*)$/.exec(line);
      if (heading) {
        const level = heading[1].length;
        const Tag = (level <= 2 ? "h3" : "h4") as "h3" | "h4";
        out.push(<Tag key={out.length}>{inline(heading[2])}</Tag>);
        index += 1;
        continue;
      }
      if (/^\s*\|.*\|\s*$/.test(line)) {
        const rows: string[][] = [];
        while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) {
          const cells = lines[index].trim().slice(1, -1).split("|").map((cell) => cell.trim());
          if (!cells.every((cell) => /^:?-{2,}:?$/.test(cell))) rows.push(cells);
          index += 1;
        }
        const [head, ...body] = rows;
        if (!head) continue;
        out.push(<div key={out.length} className="fp-result__table"><table><thead><tr>{head.map((cell, i) => <th key={i}>{inline(cell)}</th>)}</tr></thead><tbody>{body.map((row, r) => <tr key={r}>{row.map((cell, i) => <td key={i}>{inline(cell)}</td>)}</tr>)}</tbody></table></div>);
        continue;
      }
      if (/^\s*([-*]|\d+[.)])\s+/.test(line)) {
        const ordered = /^\s*\d+[.)]\s+/.test(line);
        const items: string[] = [];
        while (index < lines.length && /^\s*([-*]|\d+[.)])\s+/.test(lines[index])) { items.push(lines[index].replace(/^\s*([-*]|\d+[.)])\s+/, "")); index += 1; }
        const List = ordered ? "ol" : "ul";
        out.push(<List key={out.length}>{items.map((item, i) => <li key={i}>{inline(item)}</li>)}</List>);
        continue;
      }
      if (line.startsWith(">")) { out.push(<blockquote key={out.length}>{inline(line.replace(/^>\s?/, ""))}</blockquote>); index += 1; continue; }
      if (!line.trim()) { index += 1; continue; }
      const paragraph: string[] = [];
      while (index < lines.length && lines[index].trim() && !/^(#{1,4}\s|```|>|\s*([-*]|\d+[.)])\s+|\s*\|)/.test(lines[index])) { paragraph.push(lines[index]); index += 1; }
      out.push(<p key={out.length}>{paragraph.map((text, i) => <Fragment key={i}>{i ? <br /> : null}{inline(text)}</Fragment>)}</p>);
    }
    return out;
  }, [content]);
  return <div className="fp-result__body">{blocks}</div>;
}

export function CopyButton({ text, label = "复制正文" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return <button type="button" className="fp-result__tool" onClick={() => {
    void navigator.clipboard?.writeText(text).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1600); });
  }}>{copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}{copied ? "已复制" : label}</button>;
}

function fileName(title: string) {
  return `${title.replace(/[\\/:*?"<>|\s]+/g, "-").replace(/^-+|-+$/g, "") || "demo"}.html`;
}

/**
 * The generated app runs inside a sandboxed iframe with an opaque origin: its scripts work,
 * but it can never read this site's cookies, storage or session.
 */
const SANDBOX = "allow-scripts allow-forms allow-modals allow-popups allow-downloads";

/** Opens the demo full-screen in a new tab, still inside the same sandbox. */
function openFullScreen(demo: WorkspaceDemo) {
  const wrapper = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${demo.title.replace(/[<>&"]/g, "")}</title><style>html,body{margin:0;height:100%;background:#f5f1e8}iframe{border:0;width:100%;height:100%;display:block}</style></head><body><iframe sandbox="${SANDBOX}" title="${demo.title.replace(/[<>&"]/g, "")}"></iframe><script>document.querySelector('iframe').srcdoc=${JSON.stringify(demo.html).replace(/</g, "\\u003c")};</script></body></html>`;
  const url = URL.createObjectURL(new Blob([wrapper], { type: "text/html" }));
  window.open(url, "_blank", "noopener");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function download(demo: WorkspaceDemo) {
  const url = URL.createObjectURL(new Blob([demo.html], { type: "text/html" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName(demo.title);
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Live, usable preview of an AI-generated demo with full-screen, download and device toggles. */
export function DemoPreview({ demo }: { demo: WorkspaceDemo }) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [reloadKey, setReloadKey] = useState(0);
  return <section className="fp-demo" aria-label={`Demo 预览：${demo.title}`}>
    <div className="fp-demo__bar">
      <span className="fp-demo__dots" aria-hidden="true"><i /><i /><i /></span>
      <strong className="fp-demo__title">{demo.title}</strong>
      <div className="fp-demo__tools">
        <button type="button" className="fp-result__tool" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")} title="电脑宽度"><Monitor size={15} aria-hidden="true" /><span className="sr-only">电脑宽度</span></button>
        <button type="button" className="fp-result__tool" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")} title="手机宽度"><Smartphone size={15} aria-hidden="true" /><span className="sr-only">手机宽度</span></button>
        <button type="button" className="fp-result__tool" onClick={() => setReloadKey((value) => value + 1)} title="重新运行"><RotateCw size={15} aria-hidden="true" /><span className="sr-only">重新运行</span></button>
        <button type="button" className="fp-result__tool" onClick={() => download(demo)}><Download size={15} aria-hidden="true" />下载</button>
        <button type="button" className="fp-result__tool fp-result__tool--primary" onClick={() => openFullScreen(demo)}><ExternalLink size={15} aria-hidden="true" />全屏使用</button>
      </div>
    </div>
    <div className="fp-demo__stage" data-device={device}>
      <iframe key={reloadKey} title={demo.title} sandbox={SANDBOX} srcDoc={demo.html} className="fp-demo__frame" />
    </div>
  </section>;
}
