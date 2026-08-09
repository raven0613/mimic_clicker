import { clearRefillConfig } from '../../../configs/clearRefillConfig'
import type { RectangleBounds } from '../../../types/game'

interface ClearRefillTarget {
  bounds: RectangleBounds
  health: number | null
  jackpotPhase: string | null
  role: 'regular' | 'jackpotDisguise' | 'jackpot'
}

export function calculateVisibleIntersectionRatio(
  bounds: RectangleBounds,
  fieldBounds: RectangleBounds,
): number {
  const targetArea = bounds.width * bounds.height
  if (targetArea <= 0) return 0

  const intersectionWidth = Math.max(
    0,
    Math.min(bounds.x + bounds.width, fieldBounds.x + fieldBounds.width) -
      Math.max(bounds.x, fieldBounds.x),
  )
  const intersectionHeight = Math.max(
    0,
    Math.min(bounds.y + bounds.height, fieldBounds.y + fieldBounds.height) -
      Math.max(bounds.y, fieldBounds.y),
  )
  return (intersectionWidth * intersectionHeight) / targetArea
}

export function isEffectiveClearRefillTarget(
  target: ClearRefillTarget,
  fieldBounds: RectangleBounds,
): boolean {
  if (target.health === null || target.health <= 0) return false
  if (target.role === 'jackpot' && target.jackpotPhase !== 'chasing') {
    return false
  }
  return (
    calculateVisibleIntersectionRatio(target.bounds, fieldBounds) >=
    clearRefillConfig.minimumVisibleRatioForTarget
  )
}
