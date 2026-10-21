export function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-rose-950/40 border border-rose-500/40 px-4 py-2.5 text-xs font-mono text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.15)] animate-in fade-in">
      <div className="flex items-center gap-2">
        <span className="text-base">⚠️</span>
        <span>{message}</span>
      </div>
      <button
        onClick={onDismiss}
        className="ml-4 text-rose-400 hover:text-white font-bold leading-none p-1"
        aria-label="Dismiss error"
      >
        ✕
      </button>
    </div>
  );
}
