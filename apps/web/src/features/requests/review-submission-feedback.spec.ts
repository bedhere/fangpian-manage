import { describe, expect, it, vi, afterEach } from 'vitest';
import { finishProjectConfirmation, reviewSubmissionKey } from './review-submission-feedback';
describe('Project submission navigation', () => {
  afterEach(() => sessionStorage.clear());
  it('returns to the workspace with a one-time success message only after actual review submission', () => {
    const navigate = vi.fn();
    finishProjectConfirmation({ status: 'HUMAN_REQUIRED' }, navigate);
    expect(sessionStorage.getItem(reviewSubmissionKey)).toBe('submitted');
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });
  it('does not announce review submission for a draft that has not been submitted', () => {
    const navigate = vi.fn();
    expect(() => finishProjectConfirmation({ status: 'DRAFT' }, navigate)).toThrow('尚未进入审核');
    expect(navigate).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(reviewSubmissionKey)).toBeNull();
  });
});
