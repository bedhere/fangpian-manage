import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettlementConfirmControls } from './settlement-confirm-controls';

describe('SettlementConfirmControls', () => {
  it('requires explicit confirmation for locking and marking a batch paid', () => {
    const lock = vi.fn(); const pay = vi.fn();
    render(<SettlementConfirmControls month="2026-10" batch={{ id: 'batch1', status: 'LOCKED' }} onLock={lock} onPay={pay} />);
    fireEvent.click(screen.getByRole('slider', { name: '滑动锁定当月流水' }));
    expect(lock).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('slider', { name: '滑动锁定当月流水' }), { key: 'End' });
    expect(lock).toHaveBeenCalledOnce();
    fireEvent.keyDown(screen.getByRole('slider', { name: '滑动确认已发放' }), { key: 'End' });
    expect(pay).toHaveBeenCalledWith('batch1');
  });

  it('does not offer payment confirmation for an already paid batch', () => {
    render(<SettlementConfirmControls month="2026-10" batch={{ id: 'batch1', status: 'PAID' }} onLock={vi.fn()} onPay={vi.fn()} />);
    expect(screen.queryByRole('slider', { name: '滑动确认已发放' })).not.toBeInTheDocument();
  });
});
