export const clearRefillConfig = {
  confirmationDelayMs: 100,
  minimumRemainingRoundMs: 1_000,
  minimumVisibleRatioForTarget: 0.6,
} as const

export const clearFeedbackConfig = {
  messageText: 'CLEAR!',
  displayDurationMs: 700,
  entranceDurationMs: 120,
  fadeOutDurationMs: 220,
  riseDistancePixels: 36,
  initialScale: 0.78,
  settledScale: 1,
  verticalPositionRatio: 0.42,
  fontFamily: 'Arial, sans-serif',
  fontSizePixels: 64,
  fillColor: 0xffe36b,
  strokeColor: 0x5b2100,
  strokeWidthPixels: 7,
  refillEntrance: {
    initialScale: 0,
    growDurationMs: 160,
    peakScale: 1.05,
    settleDurationMs: 60,
    settledScale: 1,
  },
} as const
