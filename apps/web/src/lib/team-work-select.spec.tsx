import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Select } from '../../../team-work/src/components/Select';

describe('team work dropdown scrolling', () => {
  it('keeps the menu open while its options scroll, closes on page scroll, and remains reusable', () => {
    const onChange = vi.fn();
    render(<Select options={Array.from({ length: 80 }, (_, i) => ({ value: String(i), label: `成员${i}` }))} onChange={onChange} />);
    const trigger = screen.getByRole('button', { name: '请选择' });
    fireEvent.click(trigger);
    fireEvent.scroll(screen.getByRole('listbox'));
    expect(screen.getByRole('listbox')).toBeVisible();
    fireEvent.scroll(window);
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(trigger);
    fireEvent.scroll(screen.getByRole('listbox'));
    fireEvent.click(screen.getByRole('option', { name: '成员70' }));
    expect(onChange).toHaveBeenCalledWith('70');
  });
});
