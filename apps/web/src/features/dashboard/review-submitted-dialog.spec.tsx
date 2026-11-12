import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReviewSubmittedDialog } from './review-submitted-dialog';
import { reviewSubmissionKey } from '../requests/review-submission-feedback';
describe('Review submission popup', () => {
  afterEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); });
  it('announces success once after returning home and can be dismissed', () => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: vi.fn(function(this: HTMLDialogElement) { this.setAttribute('open', ''); }) });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: vi.fn(function(this: HTMLDialogElement) { this.removeAttribute('open'); }) });
    sessionStorage.setItem(reviewSubmissionKey, 'submitted');
    render(<ReviewSubmittedDialog />);
    expect(screen.getByRole('alertdialog', { name: '已经加入审核' })).toHaveAttribute('open');
    expect(sessionStorage.getItem(reviewSubmissionKey)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '我知道了' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
