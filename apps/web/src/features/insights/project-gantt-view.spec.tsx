import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProjectGanttView } from './project-gantt-view';
const projects = [
  { id: 'p1', title: '智能资料整理', status: 'IN_PROGRESS', department: '产品部', owner: '小成', progressPercent: 35, timelineNodes: [
    { id: 'START', defaultKey: 'START', title: '项目开始', scheduledAt: '2026-10-01', status: 'COMPLETED' as const, description: '' },
    { id: 'END', defaultKey: 'END', title: '项目结束', scheduledAt: '2026-10-31', status: 'PENDING' as const, description: '' },
  ] },
  { id: 'p2', title: '待排期项目', status: 'PLANNING', department: '销售部', owner: null, progressPercent: 0, timelineNodes: [] },
];
describe('Executive project Gantt', () => {
  it('shows spreadsheet columns and a calendar scale switcher', () => {
    render(<ProjectGanttView projects={projects} />);
    for (const title of ['项目 / 时间节点', '负责人', '等级', '状态', '进度', '开始日期', '结束日期']) expect(screen.getByRole('columnheader', { name: title })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '季' }));
    expect(screen.getByRole('button', { name: '季' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '回到今天' })).toBeInTheDocument();
  });
  it('shows all projects including unscheduled projects', () => {
    render(<ProjectGanttView projects={projects} />);
    expect(screen.getByText('智能资料整理')).toBeInTheDocument();
    expect(screen.getByText('待排期项目')).toBeInTheDocument();
    expect(screen.getByText(/待安排 · 进度/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '智能资料整理' })).toHaveAttribute('href', '/projects/p1/manage');
  });
  it('filters by department and expands the milestones', () => {
    render(<ProjectGanttView projects={projects} />);
    fireEvent.change(screen.getByLabelText('筛选部门'), { target: { value: '产品部' } });
    expect(screen.queryByText('待排期项目')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '展开智能资料整理的节点' }));
    expect(screen.getByText('项目开始')).toBeInTheDocument();
  });
});

