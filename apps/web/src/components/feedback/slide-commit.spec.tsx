import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SlideCommit from './slide-commit';

afterEach(() => vi.useRealTimers());

describe('SlideCommit', () => {
  it('allows dragging from the instruction area without confirming a track click', () => {
    vi.stubGlobal('PointerEvent', MouseEvent);
    const confirm = vi.fn();
    render(<SlideCommit onConfirm={confirm} />);
    const track = screen.getByRole('slider').parentElement!;
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 280 } as DOMRect);
    fireEvent.pointerDown(track, { button: 0, clientX: 150 });
    fireEvent.pointerMove(window, { clientX: 280 });
    fireEvent.pointerUp(window);
    expect(confirm).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it('does not submit when the end of the track is only pressed and released', () => {
    vi.stubGlobal('PointerEvent', MouseEvent);
    const confirm = vi.fn();
    render(<SlideCommit onConfirm={confirm} />);
    const track = screen.getByRole('slider').parentElement!;
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 280 } as DOMRect);
    fireEvent.pointerDown(track, { button: 0, clientX: 275 });
    fireEvent.pointerUp(window);
    expect(confirm).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it('requires an explicit completion rather than an ordinary click', () => {
    const confirm = vi.fn();
    render(<SlideCommit label="确认删除" onConfirm={confirm} />);
    fireEvent.click(screen.getByRole('slider', { name: '确认删除' }));
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' });
    expect(confirm).toHaveBeenCalledOnce();
  });

  it('blocks repeated confirmation while the real request is pending', async () => {
    let complete!: () => void;
    const confirm = vi.fn(() => new Promise<void>((resolve) => { complete = resolve; }));
    render(<SlideCommit onConfirm={confirm} />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'End' });
    fireEvent.keyDown(slider, { key: 'End' });
    expect(confirm).toHaveBeenCalledOnce();
    expect(slider).toHaveAttribute('aria-busy', 'true');
    await act(async () => { complete(); });
    await waitFor(() => expect(slider.closest('.slide-commit')).toHaveAttribute('data-phase', 'done'));
  });

  it('reports a failed request and allows an explicit retry', async () => {
    const error = new Error('服务器拒绝');
    const confirm = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(undefined);
    const onError = vi.fn();
    render(<SlideCommit onConfirm={confirm} onError={onError} />);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' });
    await waitFor(() => expect(onError).toHaveBeenCalledWith(error));
    expect(screen.getByRole('slider').closest('.slide-commit')).toHaveAttribute('data-phase', 'error');
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' });
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(2));
  });

  it('does not show success when an existing handler returns false', async () => {
    render(<SlideCommit onConfirm={async () => false} />);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' });
    await waitFor(() => expect(screen.getByRole('slider').closest('.slide-commit')).toHaveAttribute('data-phase', 'error'));
  });

  it('ignores input while disabled', () => {
    const confirm = vi.fn();
    render(<SlideCommit disabled onConfirm={confirm} />);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' });
    expect(confirm).not.toHaveBeenCalled();
  });

  it('does not submit a canceled or incomplete pointer drag', () => {
    vi.stubGlobal('PointerEvent', MouseEvent);
    const confirm = vi.fn();
    render(<SlideCommit onConfirm={confirm} />);
    const slider = screen.getByRole('slider');
    const track = slider.parentElement!;
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 280 } as DOMRect);
    fireEvent.pointerDown(slider, { button: 0, clientX: 24 });
    fireEvent.pointerMove(window, { clientX: 140 });
    fireEvent.pointerUp(window);
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.pointerDown(slider, { button: 0, clientX: 140 });
    fireEvent.pointerMove(window, { clientX: 500 });
    fireEvent.pointerCancel(window);
    expect(confirm).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('submits exactly once when a pointer drag reaches the end', () => {
    vi.stubGlobal('PointerEvent', MouseEvent);
    const confirm = vi.fn();
    render(<SlideCommit onConfirm={confirm} />);
    const slider = screen.getByRole('slider');
    vi.spyOn(slider.parentElement!, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 280 } as DOMRect);
    fireEvent.pointerDown(slider, { button: 0, clientX: 24 });
    fireEvent.pointerMove(window, { clientX: 270 });
    fireEvent.pointerUp(window);
    fireEvent.pointerUp(window);
    expect(confirm).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it('does not turn a click on a failed handle into a second submission', async () => {
    vi.stubGlobal('PointerEvent', MouseEvent);
    const confirm = vi.fn().mockRejectedValue(new Error('操作失败'));
    const onError = vi.fn();
    render(<SlideCommit onConfirm={confirm} onError={onError} />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'End' });
    await waitFor(() => expect(onError).toHaveBeenCalledOnce());
    fireEvent.pointerDown(slider, { button: 0, clientX: 240 });
    fireEvent.pointerUp(window);
    expect(confirm).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
