interface StatusOverlayProps {
  title: string
  message: string
  actionLabel?: string
  onAction?: () => void
}

export function StatusOverlay({
  title,
  message,
  actionLabel,
  onAction,
}: StatusOverlayProps) {
  return (
    <div className="overlay overlay--blocking">
      <section className="panel status-panel">
        <p className="eyebrow">MIMIC BREAKER</p>
        <h2>{title}</h2>
        <p>{message}</p>
        {actionLabel && onAction && (
          <button className="button button--primary" type="button" onClick={onAction}>
            {actionLabel}
          </button>
        )}
      </section>
    </div>
  )
}
