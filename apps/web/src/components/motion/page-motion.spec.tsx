import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CountUp } from "./page-motion";

afterEach(() => vi.unstubAllGlobals());

describe("page motion accessibility", () => {
  it("keeps the actual amount readable without browser animation APIs", () => {
    const { rerender } = render(<CountUp value={1200.5} currency />);
    expect(screen.getByRole("img", { name: "¥1,200.50" })).toHaveTextContent("¥1,200.50");
    rerender(<CountUp value={2450.25} currency />);
    expect(screen.getByRole("img", { name: "¥2,450.25" })).toHaveTextContent("¥2,450.25");
  });

  it("does not observe or animate numbers when reduced motion is requested", () => {
    const observe = vi.fn();
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("IntersectionObserver", observe);
    render(<CountUp value={108} />);
    expect(screen.getByRole("img", { name: "108" })).toHaveTextContent("108");
    expect(observe).not.toHaveBeenCalled();
  });

  it("cancels an active counter and restores the exact value when motion is reduced", () => {
    let onPreferenceChange: () => void = () => {};
    const media = { matches: false, addEventListener: vi.fn((_event, listener) => { onPreferenceChange = listener; }), removeEventListener: vi.fn() };
    vi.stubGlobal("matchMedia", () => media);
    vi.stubGlobal("IntersectionObserver", class {
      constructor(private callback: IntersectionObserverCallback) {}
      observe(element: Element) { this.callback([{ isIntersecting: true, target: element } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
      disconnect() {}
    });
    const { unmount } = render(<CountUp value={1200.5} currency />);
    act(() => { media.matches = true; onPreferenceChange(); });
    expect(screen.getByRole("img", { name: "¥1,200.50" })).toHaveTextContent("¥1,200.50");
    unmount();
    expect(media.removeEventListener).toHaveBeenCalled();
  });
});
