import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
export { FeedbackButton, FeedbackForm } from './action-feedback';

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function BrandLogo({
  variant = "primary",
  className,
}: {
  /** `wordmark` / `wordmark-inverse` are the transparent brush marks for light and dark surfaces. */
  variant?: "primary" | "inverse" | "square" | "wordmark" | "wordmark-inverse";
  className?: string;
}) {
  const source = {
    primary: "/brand/logo-black-yellow.webp",
    inverse: "/brand/logo-white-black.webp",
    square: "/brand/logo-yellow-square.webp",
    wordmark: "/brand/logo-wordmark-black.webp",
    "wordmark-inverse": "/brand/logo-wordmark-yellow.webp",
  }[variant];

  return <img src={source} alt="方片·敢想敢成" className={className} />;
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={joinClasses("fp-card", className)} {...props} />;
}

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={joinClasses("fp-badge", className)} {...props} />;
}

export function Button({
  className,
  variant = "primary",
  loading = false,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "dark";
  /** Shows an inline spinner and marks the button busy; pair with `disabled` to block repeats. */
  loading?: boolean;
}) {
  return (
    <button
      className={joinClasses("fp-button", `fp-button--${variant}`, className)}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <span className="fp-button__spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

/** Loading titles in this app read "正在…"; everything else on a PageState is an error or empty state. */
function inferTone(title: string): "loading" | "error" {
  return title.startsWith("正在") ? "loading" : "error";
}

export function PageState({
  title,
  description,
  image,
  action,
  tone,
}: {
  title: string;
  description: string;
  image?: string;
  action?: ReactNode;
  tone?: "loading" | "error" | "empty";
}) {
  const resolvedTone = tone ?? inferTone(title);
  const source = image ?? (resolvedTone === "loading" ? "/brand/tiger-headband-running.webp" : "/brand/tiger-thinking-seated.webp");
  return (
    <Card className="fp-page-state" role="status" data-tone={resolvedTone} aria-busy={resolvedTone === "loading" || undefined}>
      <img src={source} alt="" className="fp-page-state__image" />
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
        {resolvedTone === "loading" ? <div className="fp-page-state__progress" aria-hidden="true" /> : null}
        {action}
      </div>
    </Card>
  );
}

export { default as SlideCommit } from './slide-commit.jsx';
export type { SlideCommitProps } from './slide-commit.types';

export { SlideSubmit } from './slide-submit';

export { useActionGate } from './use-action-gate';
