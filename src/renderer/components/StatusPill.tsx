import type { ProfileStatus } from '../../shared/types';

const statusConfig: Record<ProfileStatus, { label: string; className: string; dot: string }> = {
  idle: {
    label: 'IDLE',
    className: 'bg-[#061710] text-emerald-400/80 border border-[#103827]',
    dot: 'bg-emerald-600',
  },
  running: {
    label: 'ACTIVE',
    className: 'bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/40 shadow-[0_0_10px_rgba(0,255,136,0.2)] font-bold',
    dot: 'bg-[#00ff88] animate-pulse shadow-[0_0_6px_#00ff88]',
  },
  error: {
    label: 'ERROR',
    className: 'bg-rose-950/40 text-rose-300 border border-rose-500/40 shadow-[0_0_8px_rgba(244,63,94,0.2)] font-bold',
    dot: 'bg-rose-400',
  },
};

export function StatusPill({ status }: { status: ProfileStatus }) {
  const cfg = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-mono tracking-wider uppercase ${cfg.className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
