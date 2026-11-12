export const defaultTimelineNodes = [
  { key: 'START', title: '项目开始' },
  { key: 'BETA_START', title: '上线一轮内测' },
  { key: 'BETA_END', title: '一轮内测结束' },
  { key: 'END', title: '项目结束' },
] as const;

type Node = { id: string; defaultKey: string | null; title: string; description: string; scheduledAt: Date | null; status: string };
export function mergeTimelineNodes(project: { startedAt?: Date | null; completedAt?: Date | null; deadline?: Date | null }, nodes: Node[]) {
  const defaults = defaultTimelineNodes.map(({ key, title }) => {
    const saved = nodes.find((node) => node.defaultKey === key);
    if (saved) return { ...saved, id: key };
    const actual = key === 'START' ? project.startedAt : key === 'END' ? project.completedAt : null;
    return { id: key, defaultKey: key, title, description: '', scheduledAt: actual ?? (key === 'END' ? project.deadline ?? null : null), status: actual ? 'COMPLETED' : 'PENDING' };
  });
  return [...defaults, ...nodes.filter((node) => !node.defaultKey)];
}
