export const clearRefillConfig = {
  confirmationDelayMs: 100,
  minimumRemainingRoundMs: 1_000,
  minimumVisibleRatioForTarget: 0.25,
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
} as const
