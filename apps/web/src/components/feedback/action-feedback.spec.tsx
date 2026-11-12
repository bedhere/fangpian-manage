import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FeedbackButton, FeedbackForm } from '@fangpian/ui';
import { useForm } from 'react-hook-form';
import { validatedSubmit } from './validated-submit';

describe('shared action feedback', () => {
  it('shows real request progress and blocks repeated clicks until completion', async () => {
    let finish!: () => void;
    const save = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<FeedbackButton onClick={save} successLabel="已保存">保存节点</FeedbackButton>);
    fireEvent.click(screen.getByRole('button', { name: '保存节点' }));
    expect(screen.getByRole('button', { name: '正在保存…' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button'));
    expect(save).toHaveBeenCalledOnce();
    await act(async () => finish());
    expect(screen.getByRole('button', { name: '已保存' })).toBeInTheDocument();
  });

  it('reports a rejected request and lets the user retry', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('服务失败')).mockResolvedValueOnce(undefined);
    render(<FeedbackButton onClick={save}>保存</FeedbackButton>);
    fireEvent.click(screen.getByRole('button'));
    await screen.findByRole('button', { name: '未完成，请重试' });
    fireEvent.click(screen.getByRole('button'));
    await screen.findByRole('button', { name: '已完成' });
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('uses the form callback result and never reports a caught failure as success', async () => {
    const submit = vi.fn(async (event) => { event.preventDefault(); return false; });
    render(<FeedbackForm onSubmit={submit}><input name="title" required defaultValue="节点" /><FeedbackButton>保存</FeedbackButton></FeedbackForm>);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('button', { name: '未完成，请重试' })).toBeInTheDocument());
    expect(submit).toHaveBeenCalledOnce();
  });

  it('retains native required-field validation', () => {
    const submit = vi.fn();
    render(<FeedbackForm onSubmit={submit}><input name="title" required /><FeedbackButton>保存</FeedbackButton></FeedbackForm>);
    fireEvent.click(screen.getByRole('button'));
    expect(submit).not.toHaveBeenCalled();
  });

  it('keeps React Hook Form validation failures from showing a successful submission', async () => {
    const save = vi.fn();
    function TestForm() {
      const { register, handleSubmit } = useForm<{ title: string }>();
      return <FeedbackForm onSubmit={validatedSubmit(handleSubmit, save)}><input aria-label="标题" {...register('title', { minLength: 3 })} /><FeedbackButton successLabel="已保存">保存</FeedbackButton></FeedbackForm>;
    }
    render(<TestForm />);
    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '短' } });
    fireEvent.click(screen.getByRole('button'));
    await screen.findByRole('button', { name: '未完成，请重试' });
    expect(save).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '完整标题' } });
    fireEvent.click(screen.getByRole('button'));
    await screen.findByRole('button', { name: '已保存' });
    expect(save).toHaveBeenCalledWith({ title: '完整标题' });
  });
});
