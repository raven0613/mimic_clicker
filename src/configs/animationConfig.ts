export const animationConfig = {
  hit: {
    durationMs: 120,
    flashDurationMs: 72,
    shakeDistancePixels: 5,
    shakeCycles: 3,
    scaleImpulse: 0.045,
    maximumFlashAlpha: 0.8,
    rotationReturnDurationMs: 90,
  },
  shatter: {
    columns: 2,
    rows: 2,
    durationMs: 610,
    minimumHorizontalSpeedPixelsPerSecond: 75,
    maximumHorizontalSpeedPixelsPerSecond: 210,
    minimumUpwardSpeedPixelsPerSecond: 120,
    maximumUpwardSpeedPixelsPerSecond: 290,
    gravityPixelsPerSecondSquared: 720,
    maximumRotationSpeedRadiansPerSecond: 4.8,
  },
  jackpotStun: {
    shakeDistancePixels: 7,
    shakeCycles: 5,
  },
  jackpotDisguise: {
    wobblePeriodMs: 420,
    wobbleAmplitudeRadians: 0.008,
  },
} as const
