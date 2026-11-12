import SlideCommit from '../../components/feedback/slide-commit';

export function SettlementConfirmControls({ month, batch, pending, onLock, onPay }: {
  month: string;
  batch?: { id: string; status: string };
  pending?: boolean;
  onLock: () => unknown;
  onPay: (id: string) => unknown;
}) {
  return <>
    <SlideCommit key={`lock:${month}`} label="滑动锁定当月流水" doneLabel="流水已锁定" disabled={pending || !month} onConfirm={onLock} />
    {batch?.status === 'LOCKED' ? <SlideCommit key={`pay:${batch.id}`} label="滑动确认已发放" doneLabel="已标记发放" disabled={pending} onConfirm={() => onPay(batch.id)} /> : null}
  </>;
}
