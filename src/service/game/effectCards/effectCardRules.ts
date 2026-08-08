import type { AttachedCardRarity } from '../../../configs/attachedCardConfig'
import { combatConfig } from '../../../configs/combatConfig'
import { effectCardConfig } from '../../../configs/effectCardConfig'
import type { RandomSource } from '../../../types/game'

export interface EffectCardAssignment {
  id: 'thunder'
  rarity: AttachedCardRarity
}

export interface EffectCardWindupProgress {
  elapsedMs: number
  isReady: boolean
}

export function selectEffectCardAssignments(
  decorative: boolean,
  maximumCount: number,
  random: RandomSource,
): EffectCardAssignment[] {
  if (decorative || maximumCount <= 0) return []

  const roll = random()
  const chance = effectCardConfig.thunder.carrierSpawnChance
  if (roll >= chance) return []

  return [{ id: 'thunder', rarity: 'normal' }]
}

export function calculateInitialThunderDamage(): number {
  return (
    combatConfig.initialWeaponDamage *
    effectCardConfig.thunder.initialWeaponDamageMultiplier
  )
}

export function advanceEffectCardWindup(
  elapsedMs: number,
  deltaMs: number,
): EffectCardWindupProgress {
  const nextElapsedMs = Math.min(
    effectCardConfig.ejection.durationMs,
    elapsedMs + Math.max(0, deltaMs),
  )
  return {
    elapsedMs: nextElapsedMs,
    isReady: nextElapsedMs === effectCardConfig.ejection.durationMs,
  }
}
