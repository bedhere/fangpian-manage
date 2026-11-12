import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SlideSubmit } from './slide-submit';

describe('SlideSubmit', () => {
  it('keeps invalid form fields from reaching the business callback', () => {
    const confirm = vi.fn();
    render(<form onSubmit={(event) => event.preventDefault()}><input name="score" type="number" required min="0" max="100" aria-label="评分" /><SlideSubmit label="滑动通过" onConfirm={confirm} /></form>);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' });
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('评分'), { target: { value: '120' } });
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' });
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('评分'), { target: { value: '90' } });
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' });
    expect(confirm).toHaveBeenCalledOnce();
    expect(new FormData(confirm.mock.calls[0][0]).get('score')).toBe('90');
  });
});
