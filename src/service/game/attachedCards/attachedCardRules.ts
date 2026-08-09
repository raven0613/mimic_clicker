import {
  attachedCardConfig,
  type AttachedCardFrameId,
  type EffectCardRarity,
} from '../../../configs/attachedCardConfig'
import { effectCardDefinitions } from '../../../configs/effectCardConfig'
import {
  equipmentConfig,
  equipmentDefinitions,
  type EquipmentId,
  type EquipmentRarity,
} from '../../../configs/equipmentConfig'
import type { RandomSource } from '../../../types/game'

export type EffectCardId = (typeof effectCardDefinitions)[number]['id']

export interface EffectAttachedCardAssignment {
  kind: 'effect'
  id: EffectCardId
  frameId: AttachedCardFrameId
  rarity: EffectCardRarity
}

export interface EquipmentAttachedCardAssignment {
  kind: 'equipment'
  id: EquipmentId
  rarity: EquipmentRarity
}

export type AttachedCardAssignment =
  | EffectAttachedCardAssignment
  | EquipmentAttachedCardAssignment

interface SelectAttachedCardAssignmentsInput {
  decorative: boolean
  maximumCount: number
  random: RandomSource
}

export function selectAttachedCardAssignments(
  input: SelectAttachedCardAssignmentsInput,
): AttachedCardAssignment[] {
  const capacity = normalizeCount(input.maximumCount)
  if (input.decorative || capacity === 0) return []

  const effectCandidates = effectCardDefinitions
    .filter(({ chance }) => input.random() < chance)
    .map(toEffectAssignment)
  const equipmentCandidates = equipmentDefinitions
    .filter(({ carrierSpawnChance }) => input.random() < carrierSpawnChance)
    .map(toEquipmentAssignment)
  return selectRandomAssignments(
    [...effectCandidates, ...equipmentCandidates],
    capacity,
    input.random,
  )
}

export function selectJackpotAttachedCardAssignments(
  random: RandomSource,
): AttachedCardAssignment[] {
  const targetCount = selectJackpotTargetCardCount(random)
  return selectRandomAssignments(
    [
      ...effectCardDefinitions.map(toEffectAssignment),
      ...equipmentDefinitions.map(toEquipmentAssignment),
    ],
    targetCount,
    random,
  )
}

export function selectHiddenEquipmentId(
  decorative: boolean,
  visibleEquipmentIds: readonly EquipmentId[],
  random: RandomSource,
): EquipmentId | null {
  if (decorative) return null

  const chances = equipmentConfig.hiddenDropRarityChances
  validateProbabilityDistribution(chances, 'Hidden equipment rarity')
  const rarityRoll = normalizeRandom(random())
  let rarity: EquipmentRarity | null = null
  if (rarityRoll >= chances.none) {
    rarity =
      rarityRoll < chances.none + chances.normal ? 'normal' : 'sr'
  }
  if (rarity === null) return null

  const visibleIds = new Set(visibleEquipmentIds)
  const candidates = equipmentDefinitions.filter(
    (definition) =>
      definition.rarity === rarity && !visibleIds.has(definition.id),
  )
  if (candidates.length === 0) return null
  return candidates[randomIndex(candidates.length, random)].id
}

export function selectJackpotTargetCardCount(random: RandomSource): number {
  const jackpot = attachedCardConfig.capacity.jackpot
  validateJackpotSelectionConfig(jackpot)
  return random() < jackpot.countSelectionChances.minimum
    ? jackpot.minimum
    : jackpot.maximum
}

function selectRandomAssignments<T>(
  candidates: readonly T[],
  requestedCount: number,
  random: RandomSource,
): T[] {
  const count = normalizeCount(requestedCount)
  if (candidates.length <= count) return [...candidates]

  const selectable = [...candidates]
  const selected: T[] = []
  while (selected.length < count) {
    const index = randomIndex(selectable.length, random)
    selected.push(selectable[index])
    selectable.splice(index, 1)
  }
  return selected
}

function toEffectAssignment(
  definition: (typeof effectCardDefinitions)[number],
): EffectAttachedCardAssignment {
  return {
    kind: 'effect',
    id: definition.id,
    frameId: definition.frameId,
    rarity: definition.rarity,
  }
}

function toEquipmentAssignment(
  definition: (typeof equipmentDefinitions)[number],
): EquipmentAttachedCardAssignment {
  return {
    kind: 'equipment',
    id: definition.id,
    rarity: definition.rarity,
  }
}

function validateJackpotSelectionConfig(
  config: typeof attachedCardConfig.capacity.jackpot,
): void {
  validateProbabilityDistribution(
    config.countSelectionChances,
    'Jackpot card count selection',
  )
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

function validateProbabilityDistribution(
  chances: Readonly<Record<string, number>>,
  label: string,
): void {
  const values = Object.values(chances)
  const totalChance = values.reduce((total, chance) => total + chance, 0)
  if (
    values.some((chance) => !Number.isFinite(chance) || chance < 0) ||
    Math.abs(totalChance - 1) > Number.EPSILON * values.length
  ) {
    throw new Error(
      `${label} chances must form a complete probability distribution, received ${JSON.stringify(chances)}`,
    )
  }
}

function normalizeCount(value: number): number {
  return Math.max(0, Math.floor(value))
}

function normalizeRandom(value: number): number {
  return Math.min(1 - Number.EPSILON, Math.max(0, value))
}

function randomIndex(length: number, random: RandomSource): number {
  return Math.min(length - 1, Math.floor(normalizeRandom(random()) * length))
}
