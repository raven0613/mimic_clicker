export const jackpotConfig = {
  maximumHealth: 80,
  rewardMultiplier: 5,
  chaseDurationMs: 8_000,
  chaseSpeedPixelsPerSecond: 390,
  initialDirectionMinimumRadians: Math.PI * 0.2,
  initialDirectionMaximumRadians: Math.PI * 0.8,
  minimumDirectionComponentRatio: 0.22,
  maximumTiltRadians: 0.11,
  tiltFollowSpeed: 12,
  escapeStunDurationMs: 320,
  escapeSpeedPixelsPerSecond: 820,
} as const
