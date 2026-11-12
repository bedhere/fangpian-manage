import type { ReactNode } from "react";

/** Re-mounted on every navigation, so each page arrives with a short fade-and-rise (see .fp-route). */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="fp-route">{children}</div>;
}
