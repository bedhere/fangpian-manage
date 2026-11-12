"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { FeedbackButton, FeedbackForm } from "@fangpian/ui";
import { X } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { validatedSubmit } from "../../components/feedback/validated-submit";

const applicationSchema = z.object({
  motivation: z.string().trim().min(5, "请至少填写 5 个字的申请动机").max(4000),
  estimatedHours: z.coerce.number().min(0.25, "预计工时至少为 0.25 小时"),
  relevantExperience: z.string().trim().min(2, "请填写相关经验").max(4000),
  note: z.string().trim().max(2000).optional(),
});
export type ApplicationInput = z.infer<typeof applicationSchema>;
export type ApplyResult = { status: string };

/** The same explicit application form serves market cards and shared detail pages. */
export function ProjectApplicationDialog({
  project,
  onApply,
  onSuccess,
  onClose,
}: {
  project: { id: string; title: string };
  onApply: (id: string, input: ApplicationInput) => Promise<ApplyResult>;
  onSuccess: (result: ApplyResult) => void;
  onClose: () => void;
}) {
  const form = useForm<
    z.input<typeof applicationSchema>,
    unknown,
    ApplicationInput
  >({
    resolver: zodResolver(applicationSchema),
    defaultValues: { motivation: "", relevantExperience: "", note: "" },
  });
  const dialog = useRef<HTMLDivElement>(null),
    saving = useRef(false);
  const close = () => {
    if (!saving.current) onClose();
  };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  async function submit(input: ApplicationInput) {
    if (saving.current) return false;
    saving.current = true;
    try {
      const result = await onApply(project.id, {
        ...input,
        note: input.note || undefined,
      });
      onSuccess(result);
      return true;
    } catch (e) {
      form.setError("root", {
        message: e instanceof Error ? e.message : "申请提交失败",
      });
      return false;
    } finally {
      saving.current = false;
    }
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
        "input:not(:disabled),textarea:not(:disabled),button:not(:disabled)",
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
  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={`申请承接 ${project.title}`}
        onKeyDown={keyboard}
        className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-[28px] bg-[#fffdf5] p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black tracking-[.18em] text-[#8a7b50]">
              申请承接
            </p>
            <h2 className="mt-2 text-2xl font-black">{project.title}</h2>
            <p className="mt-2 text-sm text-[#777166]">
              提交申请后，由负责人审核确认。
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭"
            disabled={form.formState.isSubmitting}
            onClick={close}
            className="grid size-10 shrink-0 place-items-center rounded-full border border-black/10 bg-white hover:bg-[#fff3bf]"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <FeedbackForm
          onSubmit={validatedSubmit(form.handleSubmit, submit)}
          className="mt-6 space-y-4"
        >
          <Field
            label="申请动机"
            error={form.formState.errors.motivation?.message}
          >
            <textarea
              {...form.register("motivation")}
              disabled={form.formState.isSubmitting}
              className="min-h-24 w-full rounded-2xl border border-black/10 bg-white p-4 outline-none focus:border-[#bd8b14]"
            />
          </Field>
          <Field
            label="预计投入工时"
            error={form.formState.errors.estimatedHours?.message}
          >
            <input
              type="number"
              min="0.25"
              step="0.25"
              {...form.register("estimatedHours")}
              disabled={form.formState.isSubmitting}
              className="h-12 w-full rounded-2xl border border-black/10 bg-white px-4 outline-none focus:border-[#bd8b14]"
            />
          </Field>
          <Field
            label="相关经验"
            error={form.formState.errors.relevantExperience?.message}
          >
            <textarea
              {...form.register("relevantExperience")}
              disabled={form.formState.isSubmitting}
              className="min-h-24 w-full rounded-2xl border border-black/10 bg-white p-4 outline-none focus:border-[#bd8b14]"
            />
          </Field>
          <Field
            label="补充说明（选填）"
            error={form.formState.errors.note?.message}
          >
            <textarea
              {...form.register("note")}
              disabled={form.formState.isSubmitting}
              className="min-h-20 w-full rounded-2xl border border-black/10 bg-white p-4 outline-none focus:border-[#bd8b14]"
            />
          </Field>
          {form.formState.errors.root ? (
            <p
              role="alert"
              className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700"
            >
              {form.formState.errors.root.message}
            </p>
          ) : null}
          <FeedbackButton
            successLabel="已提交"
            disabled={form.formState.isSubmitting}
            className="h-12 w-full rounded-2xl bg-[#ffd85f] font-black text-[#303030] disabled:opacity-60"
          >
            {form.formState.isSubmitting ? "正在提交…" : "确认提交申请"}
          </FeedbackButton>
        </FeedbackForm>
      </div>
    </div>,
    document.body,
  );
}
function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-black">
      {label}
      <span className="mt-2 block">{children}</span>
      {error ? (
        <span className="mt-1 block text-xs text-red-700">{error}</span>
      ) : null}
    </label>
  );
}
