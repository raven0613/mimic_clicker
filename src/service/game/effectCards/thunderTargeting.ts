import { effectCardConfig } from '../../../configs/effectCardConfig'
import { spawnConfig } from '../../../configs/spawnConfig'
import type { RandomSource } from '../../../types/game'
import {
  isEligibleEffectAttackTarget,
  type EffectAttackTarget,
} from './effectTargeting'

export type ThunderTarget = EffectAttackTarget

export function selectThunderTarget<T extends ThunderTarget>(
  targets: readonly T[],
  previouslySelected: ReadonlySet<unknown>,
  random: RandomSource,
): T | null {
  const eligible = targets.filter(isEligibleEffectAttackTarget)
  if (eligible.length === 0) return null

  const unselected = eligible.filter(
    (target) =>
      !previouslySelected.has(target) && !previouslySelected.has(target.id),
  )
  const candidates = unselected.length > 0 ? unselected : eligible
  const index = Math.min(
    candidates.length - 1,
    Math.floor(Math.max(0, random()) * candidates.length),
  )
  return candidates[index]
}

export function collectThunderHitTargets<T extends ThunderTarget>(
  targets: readonly T[],
  selectedTarget: T,
): T[] {
  const strikeHalfWidth =
    effectCardConfig.thunder.spriteSheet.frameWidthPixels / 2
  const strikeHalfHeight = strikeHalfWidth
  const mimicHalfWidth = spawnConfig.cardWidthPixels / 2
  const mimicHalfHeight = spawnConfig.cardHeightPixels / 2
  const uniqueTargets = new Set<T>()

  for (const target of targets) {
    if (!isEligibleEffectAttackTarget(target)) continue
    const overlaps =
      Math.abs(target.logicalX - selectedTarget.logicalX) <=
        strikeHalfWidth + mimicHalfWidth &&
      Math.abs(target.logicalY - selectedTarget.logicalY) <=
        strikeHalfHeight + mimicHalfHeight
    if (overlaps) uniqueTargets.add(target)
  }

  uniqueTargets.add(selectedTarget)
  return [...uniqueTargets]
}
