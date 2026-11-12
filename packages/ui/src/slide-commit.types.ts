import type { ReactNode } from 'react';

export type SlideCommitProps = {
  label?: ReactNode;
  doneLabel?: ReactNode;
  errorLabel?: ReactNode;
  onConfirm?: () => unknown | Promise<unknown>;
  onDone?: () => void;
  onError?: (reason: unknown) => void;
  trackColor?: string;
  handleColor?: string;
  successColor?: string;
  dangerColor?: string;
  width?: number;
  height?: number;
  radius?: number;
  speed?: number;
  returnBounce?: number;
  landingDip?: number;
  holdMs?: number;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
};
