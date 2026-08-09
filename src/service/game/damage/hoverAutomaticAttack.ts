export interface HoverAutomaticAttackTick {
  shouldAttack: boolean
  remainingMs: number
}

export function advanceHoverAutomaticAttack(
  remainingMs: number,
  deltaMs: number,
  intervalMs: number,
  includeEndpoint = true,
): HoverAutomaticAttackTick {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error(
      `Hover automatic attack interval must be positive, received ${intervalMs}`,
    )
  }
  const nextRemainingMs = remainingMs - Math.max(0, deltaMs)
  if (nextRemainingMs > 0 || (!includeEndpoint && nextRemainingMs === 0)) {
    return { shouldAttack: false, remainingMs: nextRemainingMs }
  }
  return { shouldAttack: true, remainingMs: intervalMs }
}
