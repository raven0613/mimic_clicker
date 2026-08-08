export interface OneShotAnimationProgress {
  elapsedMs: number
  frameIndex: number
  completed: boolean
}

export function advanceOneShotAnimation(
  elapsedMs: number,
  deltaMs: number,
  durationMs: number,
  frameCount: number,
): OneShotAnimationProgress {
  assertAnimationInput(durationMs, frameCount)
  const nextElapsedMs = Math.min(
    durationMs,
    elapsedMs + Math.max(0, deltaMs),
  )
  return {
    elapsedMs: nextElapsedMs,
    frameIndex: Math.min(
      frameCount - 1,
      Math.floor((nextElapsedMs / durationMs) * frameCount),
    ),
    completed: nextElapsedMs === durationMs,
  }
}

export function getLoopingFrameIndex(
  elapsedMs: number,
  cycleDurationMs: number,
  frameCount: number,
): number {
  assertAnimationInput(cycleDurationMs, frameCount)
  const cycleElapsedMs = Math.max(0, elapsedMs) % cycleDurationMs
  return Math.min(
    frameCount - 1,
    Math.floor((cycleElapsedMs / cycleDurationMs) * frameCount),
  )
}

function assertAnimationInput(durationMs: number, frameCount: number): void {
  if (durationMs <= 0 || frameCount <= 0) {
    throw new Error(
      `Sprite-sheet animation requires positive duration and frame count; received ${durationMs}ms and ${frameCount} frames`,
    )
  }
}
