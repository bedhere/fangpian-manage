import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProjectTimelineView } from './project-timeline-view';

const nodes = [{ id: 'START', defaultKey: 'START', title: '项目开始', description: '', scheduledAt: null, status: 'PENDING' as const }];
describe('Project timeline', () => {
  it('shows unscheduled default nodes and real progress without an hour calendar', () => {
    render(<ProjectTimelineView nodes={nodes} progress={35} canEdit={false} onAction={vi.fn()} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '35');
    expect(screen.getByText('待安排')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '新增时间节点' })).not.toBeInTheDocument();
  });
  it('lets the owner add a node with a date', async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    render(<ProjectTimelineView nodes={nodes} progress={0} canEdit onAction={action} />);
    fireEvent.click(screen.getByRole('button', { name: '新增时间节点' }));
    fireEvent.change(screen.getByLabelText('节点名称'), { target: { value: '需求评审' } });
    fireEvent.change(screen.getByLabelText('节点日期'), { target: { value: '2026-10-20' } });
    fireEvent.click(screen.getByRole('button', { name: '保存节点' }));
    await waitFor(() => expect(action).toHaveBeenCalledWith('save-timeline-node', expect.objectContaining({ title: '需求评审', date: '2026-10-20' })));
    expect(await screen.findByRole('status')).toHaveTextContent('节点已保存');
  });
  it('retains the form and explains a failed save', async () => {
    render(<ProjectTimelineView nodes={nodes} progress={0} canEdit onAction={vi.fn().mockRejectedValue(new Error('保存失败，请重试'))} />);
    fireEvent.click(screen.getByRole('button', { name: '新增时间节点' }));
    fireEvent.change(screen.getByLabelText('节点名称'), { target: { value: '需求评审' } });
    fireEvent.click(screen.getByRole('button', { name: '保存节点' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('保存失败，请重试');
    expect(screen.getByLabelText('节点名称')).toHaveValue('需求评审');
  });
  it('keeps default nodes named and prevents deleting them in the editor', () => {
    render(<ProjectTimelineView nodes={nodes} progress={0} canEdit onAction={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '编辑项目开始' }));
    expect(screen.getByLabelText('节点名称')).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: '删除节点' })).not.toBeInTheDocument();
  });
  it('requires confirmation before removing a custom timeline node', async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    render(<ProjectTimelineView nodes={[{ ...nodes[0], id: 'custom', defaultKey: null, title: '需求评审' }]} progress={0} canEdit onAction={action} />);
    fireEvent.click(screen.getByRole('button', { name: '编辑需求评审' }));
    fireEvent.click(screen.getByRole('button', { name: '删除节点' }));
    expect(action).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('slider', { name: '滑动确认删除' }), { key: 'End' });
    await waitFor(() => expect(action).toHaveBeenCalledWith('delete-timeline-node', { nodeId: 'custom' }));
  });
});
