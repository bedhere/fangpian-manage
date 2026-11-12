'use client';

import { useRef, useState } from 'react';

/** Share one in-flight decision across a slider and its neighboring actions. */
export function useActionGate() {
  const active = useRef(false);
  const [pending, setPending] = useState(false);
  async function run<T>(action: () => T | Promise<T>): Promise<T | false> {
    if (active.current) return false;
    active.current = true;
    setPending(true);
    try {
      return await action();
    } finally {
      active.current = false;
      setPending(false);
    }
  }
  return { pending, run };
}
