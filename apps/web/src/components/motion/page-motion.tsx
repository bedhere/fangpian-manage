"use client";

// React Bits-inspired adaptations: Blur Text, Animated Content, Count Up and Glare Hover.
// Component references and upstream license: docs/ui-phase-one.md.
import { animate } from "motion";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

export function AnimatedContent({ children, className = "", delay = 0 }: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !window.matchMedia || !window.IntersectionObserver || !element.animate) return;
    const preference = window.matchMedia(reducedMotionQuery);
    if (preference.matches) return;
    let animation: Animation | undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      animation = element.animate([
        { opacity: 0, transform: "translateY(14px)" },
        { opacity: 1, transform: "translateY(0)" },
      ], { duration: 420, delay: Math.min(delay, 240), easing: "cubic-bezier(.16,1,.3,1)", fill: "backwards" });
    }, { threshold: 0.08 });
    const stop = () => { if (preference.matches) { observer.disconnect(); animation?.cancel(); } };
    preference.addEventListener("change", stop);
    observer.observe(element);
    return () => { observer.disconnect(); animation?.cancel(); preference.removeEventListener("change", stop); };
  }, [delay]);
  return <div ref={ref} className={className}>{children}</div>;
}

export function BlurText({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return <span className="fp-blur-text" style={{ "--fp-motion-delay": `${delay}ms` } as CSSProperties}>{children}</span>;
}

export function CountUp({ value, currency = false }: { value: number; currency?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const safeValue = Number.isFinite(value) ? value : 0;
  const formatter = new Intl.NumberFormat("zh-CN", currency
    ? { style: "currency", currency: "CNY" }
    : { maximumFractionDigits: 0 });
  const formatted = formatter.format(safeValue);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.textContent = formatted;
    if (!window.matchMedia || !window.IntersectionObserver) return;
    const preference = window.matchMedia(reducedMotionQuery);
    if (preference.matches) return;
    const numberFormat = new Intl.NumberFormat("zh-CN", currency
      ? { style: "currency", currency: "CNY" }
      : { maximumFractionDigits: 0 });
    let controls: ReturnType<typeof animate> | undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      controls = animate(0, safeValue, {
        duration: 0.8,
        ease: "easeOut",
        onUpdate: (latest) => { element.textContent = numberFormat.format(latest); },
        onComplete: () => { element.textContent = formatted; },
      });
    }, { threshold: 0.2 });
    const stop = () => {
      if (preference.matches) { observer.disconnect(); controls?.stop(); element.textContent = formatted; }
    };
    preference.addEventListener("change", stop);
    observer.observe(element);
    return () => { observer.disconnect(); controls?.stop(); preference.removeEventListener("change", stop); };
  }, [safeValue, currency, formatted]);

  // Assistive technology always receives the real value, never the intermediate count.
  return <span role="img" aria-label={formatted} className="fp-count-up"><span ref={ref} aria-hidden="true">{formatted}</span></span>;
}
