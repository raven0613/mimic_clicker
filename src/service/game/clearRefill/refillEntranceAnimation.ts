import { clearFeedbackConfig } from '../../../configs/clearRefillConfig'
import type { RuntimeMimicEntity } from '../runtimeTypes'

const refillEntranceConfig = clearFeedbackConfig.refillEntrance
const refillEntranceDurationMs =
  refillEntranceConfig.growDurationMs +
  refillEntranceConfig.settleDurationMs

export function initializeRefillEntranceAnimation(
  entity: RuntimeMimicEntity,
  shouldAnimate: boolean,
): void {
  entity.refillEntranceElapsedMs = shouldAnimate ? 0 : null
  entity.visualContainer.scale.set(
    shouldAnimate
      ? refillEntranceConfig.initialScale
      : refillEntranceConfig.settledScale,
  )
}

export function updateRefillEntranceAnimation(
  entity: RuntimeMimicEntity,
  deltaMs: number,
): void {
  if (entity.refillEntranceElapsedMs === null) return

  const elapsedMs = Math.min(
    refillEntranceDurationMs,
    entity.refillEntranceElapsedMs + Math.max(0, deltaMs),
  )
  entity.visualContainer.scale.set(calculateRefillEntranceScale(elapsedMs))
  entity.refillEntranceElapsedMs =
    elapsedMs >= refillEntranceDurationMs ? null : elapsedMs
}

export function calculateRefillEntranceScale(elapsedMs: number): number {
  const clampedElapsedMs = Math.max(0, elapsedMs)
  if (clampedElapsedMs <= refillEntranceConfig.growDurationMs) {
    const growProgress =
      clampedElapsedMs / refillEntranceConfig.growDurationMs
    return interpolateScale(
      refillEntranceConfig.initialScale,
      refillEntranceConfig.peakScale,
      easeOutCubic(growProgress),
    )
  }

  const settleProgress = Math.min(
    1,
    (clampedElapsedMs - refillEntranceConfig.growDurationMs) /
      refillEntranceConfig.settleDurationMs,
  )
  return interpolateScale(
    refillEntranceConfig.peakScale,
    refillEntranceConfig.settledScale,
    easeOutCubic(settleProgress),
  )
}

function interpolateScale(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}

function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3
}
