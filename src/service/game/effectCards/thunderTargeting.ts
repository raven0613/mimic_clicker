import { effectCardConfig } from '../../../configs/effectCardConfig'
import { spawnConfig } from '../../../configs/spawnConfig'
import type { RandomSource } from '../../../types/game'
import type { JackpotLifecycle } from '../../combat/combat'

export interface ThunderTarget {
  id: unknown
  role: 'regular' | 'jackpotDisguise' | 'jackpot'
  health: number | null
  logicalX: number
  logicalY: number
  jackpotPhase: JackpotLifecycle['phase'] | null
}

export function isEligibleThunderTarget(target: ThunderTarget): boolean {
  if (target.health === null || target.health <= 0) return false
  return target.role !== 'jackpot' || target.jackpotPhase === 'chasing'
}

export function selectThunderTarget<T extends ThunderTarget>(
  targets: readonly T[],
  previouslySelected: ReadonlySet<unknown>,
  random: RandomSource,
): T | null {
  const eligible = targets.filter(isEligibleThunderTarget)
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
    if (!isEligibleThunderTarget(target)) continue
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
