import {
  attachedCardConfig,
  type AttachedCardFrameId,
  type AttachedCardRarity,
} from '../../../configs/attachedCardConfig'
import { combatConfig } from '../../../configs/combatConfig'
import {
  effectCardConfig,
  effectCardDefinitions,
} from '../../../configs/effectCardConfig'
import type { RandomSource } from '../../../types/game'

export type EffectCardId = (typeof effectCardDefinitions)[number]['id']

export interface EffectCardAssignment {
  id: EffectCardId
  frameId: AttachedCardFrameId
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
  const capacity = Math.max(0, Math.floor(maximumCount))
  if (decorative || capacity === 0) return []

  const candidates = effectCardDefinitions
    .filter(({ chance }) => random() < chance)
    .map(toEffectCardAssignment)
  return selectRandomAssignments(candidates, capacity, random)
}

export function selectJackpotTargetCardCount(random: RandomSource): number {
  const jackpot = attachedCardConfig.capacity.jackpot
  validateJackpotSelectionConfig(jackpot)
  return random() < jackpot.countSelectionChances.minimum
    ? jackpot.minimum
    : jackpot.maximum
}

export function selectJackpotEffectCardAssignments(
  random: RandomSource,
): EffectCardAssignment[] {
  const targetCount = selectJackpotTargetCardCount(random)
  const candidates = effectCardDefinitions.map(toEffectCardAssignment)
  return selectRandomAssignments(candidates, targetCount, random)
}

function selectRandomAssignments(
  candidates: readonly EffectCardAssignment[],
  requestedCount: number,
  random: RandomSource,
): EffectCardAssignment[] {
  const count = Math.max(0, Math.floor(requestedCount))
  if (candidates.length <= count) return [...candidates]

  const selectable = [...candidates]
  const selected: EffectCardAssignment[] = []
  while (selected.length < count) {
    const index = randomIndex(selectable.length, random)
    selected.push(selectable[index])
    selectable.splice(index, 1)
  }
  return selected
}

function toEffectCardAssignment(
  definition: (typeof effectCardDefinitions)[number],
): EffectCardAssignment {
  const { id, frameId, rarity } = definition
  return { id, frameId, rarity }
}

function validateJackpotSelectionConfig(
  config: typeof attachedCardConfig.capacity.jackpot,
): void {
  const chances = config.countSelectionChances
  const totalChance = chances.minimum + chances.maximum
  const hasInvalidChance =
    !Number.isFinite(chances.minimum) ||
    !Number.isFinite(chances.maximum) ||
    chances.minimum < 0 ||
    chances.maximum < 0 ||
    Math.abs(totalChance - 1) > Number.EPSILON * 4
  if (hasInvalidChance) {
    throw new Error(
      `Jackpot card count selection chances must form a complete probability distribution, received minimum=${chances.minimum}, maximum=${chances.maximum}`,
    )
  }
  if (
    !Number.isInteger(config.minimum) ||
    !Number.isInteger(config.maximum) ||
    config.minimum < 0 ||
    config.maximum < config.minimum
  ) {
    throw new Error(
      `Jackpot card count range must be non-negative integers in ascending order, received minimum=${config.minimum}, maximum=${config.maximum}`,
    )
  }
}

export function calculateInitialThunderDamage(): number {
  return (
    combatConfig.initialWeaponDamage *
    effectCardConfig.thunder.initialWeaponDamageMultiplier
  )
}

export function calculateInitialMeteoriteDamage(): number {
  return (
    combatConfig.initialWeaponDamage *
    effectCardConfig.meteorite.initialWeaponDamageMultiplier
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

function randomIndex(length: number, random: RandomSource): number {
  return Math.min(length - 1, Math.floor(Math.max(0, random()) * length))
}
