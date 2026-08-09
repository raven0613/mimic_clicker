import { animationConfig } from '../../configs/animationConfig'
import type { AttachedCardRarity } from '../../configs/attachedCardConfig'
import { balanceSimulationConfig } from '../../configs/balanceSimulationConfig'
import { combatConfig } from '../../configs/combatConfig'
import {
  equipmentConfig,
  equipmentDefinitions,
  type EquipmentId,
} from '../../configs/equipmentConfig'
import { jackpotConfig } from '../../configs/jackpotConfig'
import { mimicConfigs } from '../../configs/mimicConfigs'
import { roundConfig } from '../../configs/roundConfig'
import { spawnConfig } from '../../configs/spawnConfig'
import type { JackpotOutcome, MimicId, RandomSource } from '../../types/game'
import { evaluateWeaponDamageInterval } from '../game/damage/weaponDamageInterval'
import { selectVisibleEquipmentDrops } from '../game/equipment/equipmentDropRules'
import {
  EquipmentState,
  type EquipmentReservation,
} from '../game/equipment/equipmentState'
import type { SimulatedAttachedContent } from './attachedCardSimulation'
import { simulateCoinCollectionCompletionMs } from './coinRewardTimingSimulation'
import { simulateEquipmentSettlingCompletionMs } from './equipmentRewardTimingSimulation'

export type EquipmentCounts = Record<EquipmentId, number>

export interface EquipmentCombatMimic extends SimulatedAttachedContent {
  id: number
  mimicId: MimicId
  spawnedAtMs: number
  initialY: number
}

export interface RoundEquipmentMetrics {
  visibleGenerated: EquipmentCounts
  hiddenGenerated: EquipmentCounts
  successfulDrops: EquipmentCounts
  equipped: EquipmentCounts
  backpack: EquipmentCounts
  activationTimeTotalMs: number
  activationCount: number
  swordAdditionalDamage: number
  ringAdditionalDamage: number
  ringDamageStrikes: number
  defeatedMimics: number
  ordinaryIncome: number
  jackpotRevealed: boolean
  jackpotDefeated: boolean
}

interface SimulateEquipmentCombatRoundInput {
  ordinaryMimics: readonly EquipmentCombatMimic[]
  shellMimicId: MimicId
  shellContent: SimulatedAttachedContent
  jackpotContent: SimulatedAttachedContent
  jackpotReward: number
  jackpotCase: JackpotOutcome
  initialLoadout: readonly EquipmentId[]
  clickRate: number
  accuracy: number
  random: RandomSource
}

interface CombatTarget extends SimulatedAttachedContent {
  runtimeId: number
  kind: 'ordinary' | 'jackpot'
  mimicId: MimicId
  health: number
  spawnedAtMs: number
  expiresAtMs: number
  initialY: number
  nextWeaponDamageAllowedAtMs: number
  jackpotPhase: 'shell' | 'true' | null
}

interface RingStrikeEvent {
  kind: 'ringStrike'
  atMs: number
  targetId: number
  damage: number
}

interface EquipmentArrivalEvent {
  kind: 'equipmentArrival'
  atMs: number
  sourceResolvedAtMs: number
  reservation: EquipmentReservation
}

type EquipmentCombatEvent = RingStrikeEvent | EquipmentArrivalEvent

const rarityById = new Map<EquipmentId, AttachedCardRarity>(
  equipmentDefinitions.map(({ id, rarity }) => [id, rarity]),
)

export function simulateEquipmentCombatRound(
  input: SimulateEquipmentCombatRoundInput,
): RoundEquipmentMetrics {
  const state = createInitialEquipmentState(input.initialLoadout)
  const metrics = createEmptyMetrics()
  const targets = input.ordinaryMimics.map(toCombatTarget)
  const events: EquipmentCombatEvent[] = []
  let acceptedManualHitCount = 0

  for (const mimic of input.ordinaryMimics) addGenerated(metrics, mimic)
  addGenerated(metrics, input.shellContent)
  const jackpotTarget = createJackpotTarget(input)

  const resolveDrops = (
    target: CombatTarget,
    atMs: number,
    hasCoinReward: boolean,
  ) => {
    const visibleDrops = selectVisibleEquipmentDrops(
      target.visibleEquipmentIds,
      input.random,
    )
    const successfulIds = [...visibleDrops.successful]
    if (target.hiddenEquipmentId) {
      successfulIds.push(target.hiddenEquipmentId)
    }
    addIds(metrics.successfulDrops, successfulIds)
    const reservations = state.reserveDrops(
      successfulIds.map(toEquipmentDrop),
    )
    const sourceY = targetYAt(target, atMs)
    const settlingCompletionTimes = reservations.map(() =>
      simulateEquipmentSettlingCompletionMs({
        x: balanceSimulationConfig.field.widthPixels / 2,
        y: sourceY,
        fieldHeight: balanceSimulationConfig.field.heightPixels,
        random: input.random,
      }),
    )
    const reward =
      target.kind === 'jackpot' && target.jackpotPhase === 'true'
        ? input.jackpotReward
        : mimicConfigs[target.mimicId].baseReward
    const waitMs = hasCoinReward
      ? simulateCoinCollectionCompletionMs({
          reward,
          x: balanceSimulationConfig.field.widthPixels / 2,
          y: sourceY,
          fieldHeight: balanceSimulationConfig.field.heightPixels,
          random: input.random,
        }) + animationConfig.equipmentReward.postCoinCollectionDelayMs
      : animationConfig.equipmentReward.noCoinFallbackDelayMs
    for (let index = 0; index < reservations.length; index += 1) {
      const reservation = reservations[index]
      events.push({
        kind: 'equipmentArrival',
        atMs:
          atMs +
          Math.max(waitMs, settlingCompletionTimes[index]) +
          animationConfig.equipmentReward.collectionDurationMs,
        sourceResolvedAtMs: atMs,
        reservation,
      })
    }
  }

  const damageTarget = (
    target: CombatTarget,
    damage: number,
    atMs: number,
    source: 'weapon' | 'ring',
  ) => {
    const healthBeforeDamage = target.health
    target.health = Math.max(0, target.health - damage)
    if (source === 'weapon') {
      metrics.swordAdditionalDamage += Math.min(
        Math.max(0, healthBeforeDamage - combatConfig.initialWeaponDamage),
        Math.max(0, damage - combatConfig.initialWeaponDamage),
      )
    } else {
      metrics.ringAdditionalDamage += Math.min(healthBeforeDamage, damage)
      metrics.ringDamageStrikes += 1
    }
    if (target.health > 0) return

    if (target.kind === 'ordinary') {
      metrics.defeatedMimics += 1
      metrics.ordinaryIncome += mimicConfigs[target.mimicId].baseReward
      resolveDrops(target, atMs, true)
      return
    }
    if (target.jackpotPhase === 'shell') {
      resolveDrops(target, atMs, false)
      target.jackpotPhase = 'true'
      target.health = jackpotConfig.maximumHealth
      target.spawnedAtMs = atMs
      target.expiresAtMs = Math.min(
        roundConfig.durationMs,
        atMs + jackpotConfig.chaseDurationMs,
      )
      Object.assign(target, input.jackpotContent)
      addGenerated(metrics, input.jackpotContent)
      metrics.jackpotRevealed = true
      return
    }
    metrics.jackpotDefeated = true
    resolveDrops(target, atMs, true)
  }

  const processEventsThrough = (throughMs: number, inclusive = true) => {
    while (true) {
      events.sort((first, second) => first.atMs - second.atMs)
      const event = events[0]
      if (
        !event ||
        event.atMs > throughMs ||
        (!inclusive && event.atMs === throughMs)
      ) {
        return
      }
      events.shift()
      if (event.kind === 'equipmentArrival') {
        state.completeReservation(event.reservation.reservationId)
        const isEquipped = event.reservation.destination.type === 'slot'
        const metric = isEquipped ? metrics.equipped : metrics.backpack
        metric[event.reservation.id] += 1
        if (isEquipped) {
          metrics.activationTimeTotalMs +=
            event.atMs - event.sourceResolvedAtMs
          metrics.activationCount += 1
        }
        continue
      }
      const target = findTargetByRuntimeId(
        targets,
        jackpotTarget,
        event.targetId,
        event.atMs,
      )
      if (!target) continue
      damageTarget(target, event.damage, event.atMs, 'ring')
    }
  }

  const clickIntervalMs = 1_000 / (input.clickRate * input.accuracy)
  for (
    let clickAtMs = clickIntervalMs;
    clickAtMs < roundConfig.durationMs;
    clickAtMs += clickIntervalMs
  ) {
    processEventsThrough(clickAtMs)
    const target = selectClickTarget(
      targets,
      jackpotTarget,
      input.jackpotCase,
      clickAtMs,
    )
    if (!target) continue
    const interval = evaluateWeaponDamageInterval(
      target.nextWeaponDamageAllowedAtMs,
      clickAtMs,
    )
    if (!interval.isAllowed) continue
    target.nextWeaponDamageAllowedAtMs = interval.nextAllowedAtMs
    const weaponDamage = state.calculateWeaponDamage(
      combatConfig.initialWeaponDamage,
    )
    damageTarget(target, weaponDamage, clickAtMs, 'weapon')

    const ringCount = state.getEquippedCount('ring')
    if (ringCount === 0) continue
    acceptedManualHitCount += 1
    if (
      acceptedManualHitCount <
      equipmentConfig.ring.acceptedManualHitsPerTrigger
    ) {
      continue
    }
    acceptedManualHitCount = 0
    let queueTailAtMs = Math.max(
      clickAtMs,
      ...events
        .filter((event) => event.kind === 'ringStrike')
        .map((event) => event.atMs),
    )
    for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
      queueTailAtMs += equipmentConfig.ring.additionalHitIntervalMs
      events.push({
        kind: 'ringStrike',
        atMs: queueTailAtMs,
        targetId: target.runtimeId,
        damage:
          weaponDamage * equipmentConfig.ring.additionalDamageMultiplier,
      })
    }
  }
  processEventsThrough(roundConfig.durationMs, false)
  return metrics
}

function selectClickTarget(
  targets: readonly CombatTarget[],
  jackpot: CombatTarget,
  jackpotCase: JackpotOutcome,
  atMs: number,
): CombatTarget | null {
  if (jackpotCase !== 'notRevealed' && isActive(jackpot, atMs)) {
    if (jackpot.jackpotPhase === 'shell' || jackpotCase === 'defeated') {
      return jackpot
    }
  }
  return targets.find((target) => isActive(target, atMs)) ?? null
}

function findTargetByRuntimeId(
  targets: readonly CombatTarget[],
  jackpot: CombatTarget,
  runtimeId: number,
  atMs: number,
): CombatTarget | null {
  if (jackpot.runtimeId === runtimeId && isActive(jackpot, atMs)) return jackpot
  return targets.find(
    (target) => target.runtimeId === runtimeId && isActive(target, atMs),
  ) ?? null
}

function isActive(target: CombatTarget, atMs: number): boolean {
  return (
    target.health > 0 &&
    target.spawnedAtMs <= atMs &&
    atMs < target.expiresAtMs
  )
}

function createJackpotTarget(
  input: SimulateEquipmentCombatRoundInput,
): CombatTarget {
  return {
    ...input.shellContent,
    runtimeId: -1,
    kind: 'jackpot',
    mimicId: input.shellMimicId,
    health: mimicConfigs[input.shellMimicId].maximumHealth,
    spawnedAtMs: roundConfig.initialJackpotSpawnDelayMs,
    expiresAtMs:
      roundConfig.initialJackpotSpawnDelayMs +
      roundConfig.mimicFieldTravelDurationMs,
    initialY: -spawnConfig.cardHeightPixels / 2,
    nextWeaponDamageAllowedAtMs: 0,
    jackpotPhase: 'shell',
  }
}

function toCombatTarget(mimic: EquipmentCombatMimic): CombatTarget {
  return {
    ...mimic,
    runtimeId: mimic.id,
    kind: 'ordinary',
    health: mimicConfigs[mimic.mimicId].maximumHealth,
    expiresAtMs:
      mimic.spawnedAtMs + roundConfig.mimicFieldTravelDurationMs,
    nextWeaponDamageAllowedAtMs: 0,
    jackpotPhase: null,
  }
}

function targetYAt(target: CombatTarget, atMs: number): number {
  if (target.kind === 'jackpot' && target.jackpotPhase === 'true') {
    return balanceSimulationConfig.field.heightPixels / 2
  }
  const movementSpeed =
    (balanceSimulationConfig.field.heightPixels +
      spawnConfig.cardHeightPixels * 2) /
    (roundConfig.mimicFieldTravelDurationMs / 1_000)
  return target.initialY + movementSpeed * ((atMs - target.spawnedAtMs) / 1_000)
}

function createInitialEquipmentState(
  initialLoadout: readonly EquipmentId[],
): EquipmentState {
  const state = new EquipmentState()
  for (const reservation of state.reserveDrops(
    initialLoadout.map(toEquipmentDrop),
  )) {
    state.completeReservation(reservation.reservationId)
  }
  return state
}

function toEquipmentDrop(id: EquipmentId): {
  id: EquipmentId
  rarity: AttachedCardRarity
} {
  const rarity = rarityById.get(id)
  if (!rarity) throw new Error(`Missing rarity for equipment ${id}`)
  return { id, rarity }
}

function createEmptyMetrics(): RoundEquipmentMetrics {
  return {
    visibleGenerated: emptyCounts(),
    hiddenGenerated: emptyCounts(),
    successfulDrops: emptyCounts(),
    equipped: emptyCounts(),
    backpack: emptyCounts(),
    activationTimeTotalMs: 0,
    activationCount: 0,
    swordAdditionalDamage: 0,
    ringAdditionalDamage: 0,
    ringDamageStrikes: 0,
    defeatedMimics: 0,
    ordinaryIncome: 0,
    jackpotRevealed: false,
    jackpotDefeated: false,
  }
}

function emptyCounts(): EquipmentCounts {
  return { sword: 0, ring: 0 }
}

function addGenerated(
  metrics: RoundEquipmentMetrics,
  source: SimulatedAttachedContent,
): void {
  addIds(metrics.visibleGenerated, source.visibleEquipmentIds)
  if (source.hiddenEquipmentId) {
    metrics.hiddenGenerated[source.hiddenEquipmentId] += 1
  }
}

function addIds(counts: EquipmentCounts, ids: readonly EquipmentId[]): void {
  for (const id of ids) counts[id] += 1
}
