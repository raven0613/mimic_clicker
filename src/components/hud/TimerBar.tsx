interface TimerBarProps {
  label: string
  remainingMs: number
  durationMs: number
  variant: 'main' | 'jackpot'
}

export function TimerBar({
  label,
  remainingMs,
  durationMs,
  variant,
}: TimerBarProps) {
  const ratio = Math.max(0, Math.min(1, remainingMs / durationMs))

  return (
    <div className={`timer timer--${variant}`}>
      <div className="timer__label">
        <span>{label}</span>
        <span>{(remainingMs / 1_000).toFixed(1)}s</span>
      </div>
      <div className="timer__track">
        <div className="timer__fill" style={{ transform: `scaleX(${ratio})` }} />
      </div>
    </div>
  )
}
