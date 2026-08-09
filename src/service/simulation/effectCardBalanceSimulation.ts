import { balanceSimulationConfig } from '../../configs/balanceSimulationConfig'
import { combatConfig } from '../../configs/combatConfig'
import { effectCardConfig } from '../../configs/effectCardConfig'
import type { EquipmentId } from '../../configs/equipmentConfig'
import { mimicConfigs } from '../../configs/mimicConfigs'
import { roundConfig } from '../../configs/roundConfig'
import { spawnConfig } from '../../configs/spawnConfig'
import type { MimicId, RandomSource, Vector2 } from '../../types/game'
import type { EffectCardId } from '../game/attachedCards/attachedCardRules'
import {
  calculateInitialMeteoriteDamage,
  calculateInitialThunderDamage,
} from '../game/effectCards/effectCardRules'
import {
  collectMeteoriteHitTargets,
  createMeteoriteLaunchOffsets,
  createMeteoriteTrajectory,
  selectMeteoriteLandingPoint,
} from '../game/effectCards/meteoriteRules'
import {
  collectThunderHitTargets,
  selectThunderTarget,
  type ThunderTarget,
} from '../game/effectCards/thunderTargeting'
import { evaluateWeaponDamageInterval } from '../game/damage/weaponDamageInterval'

export interface BalanceCombatMimic extends ThunderTarget {
  id: number
  mimicId: MimicId
  spawnedAtMs: number
  initialY: number
  effectCardIds: EffectCardId[]
  visibleEquipmentIds: EquipmentId[]
  hiddenEquipmentId: EquipmentId | null
}

export interface SimulatedEffectCardEvent {
  id: EffectCardId
  readyAtMs: number
  chainDepth: number
  meteoriteLandings?: Vector2[]
  meteoriteLaunchOffsetsMs?: number[]
}

interface SimulatedMeteoriteImpact {
  kind: 'meteoriteImpact'
  impactAtMs: number
  landing: Vector2
  chainDepth: number
}

interface PendingCardEvent extends SimulatedEffectCardEvent {
  kind: 'card'
}

type PendingEffectEvent = PendingCardEvent | SimulatedMeteoriteImpact

export interface EffectCardCombatMetrics {
  defeatedByMimic: Record<MimicId, number>
  ordinaryIncome: number
  cardsTriggered: Record<EffectCardId, number>
  attackHits: Record<EffectCardId, number>
  additionalDamage: Record<EffectCardId, number>
  defeats: Record<EffectCardId, number>
  thunderStrikesTriggered: number
  meteoritesLaunched: number
  meteoriteImpacts: number
  maximumEffectChainDepth: number
}

const field = balanceSimulationConfig.field

function emptyMimicCounts(): Record<MimicId, number> {
  return { normal: 0, rare1: 0, rare2: 0 }
}

function emptyEffectCounts(): Record<EffectCardId, number> {
  return { thunder: 0, meteorite: 0 }
}

export function simulateEffectCardCombat(
  sourceMimics: readonly BalanceCombatMimic[],
  availableClickBudget: number,
  clickRate: number,
  accuracy: number,
  random: RandomSource,
  scheduledCardEvents: readonly SimulatedEffectCardEvent[] = [],
): EffectCardCombatMetrics {
  const mimics = sourceMimics.map((mimic) => ({
    ...mimic,
    effectCardIds: [...mimic.effectCardIds],
    nextWeaponDamageAllowedAtMs: 0,
  }))
  const defeatedByMimic = emptyMimicCounts()
  const cardsTriggered = emptyEffectCounts()
  const attackHits = emptyEffectCounts()
  const additionalDamage = emptyEffectCounts()
  const defeats = emptyEffectCounts()
  const pendingEvents: PendingEffectEvent[] = scheduledCardEvents.map(
    (event) => ({ ...event, kind: 'card' }),
  )
  const movementSpeed =
    (field.heightPixels + spawnConfig.cardHeightPixels * 2) /
    (roundConfig.mimicFieldTravelDurationMs / 1_000)
  let ordinaryIncome = 0
  let thunderStrikesTriggered = 0
  let meteoritesLaunched = 0
  let meteoriteImpacts = 0
  let maximumEffectChainDepth = 0

  const getActiveMimics = (atMs: number) =>
    mimics.filter((mimic) => {
      mimic.logicalY =
        mimic.initialY + movementSpeed * ((atMs - mimic.spawnedAtMs) / 1_000)
      return (
        mimic.spawnedAtMs <= atMs &&
        atMs - mimic.spawnedAtMs < roundConfig.mimicFieldTravelDurationMs &&
        mimic.health !== null &&
        mimic.health > 0
      )
    })

  const defeatMimic = (
    mimic: BalanceCombatMimic,
    atMs: number,
    chainDepth: number,
    source: EffectCardId | null,
  ) => {
    defeatedByMimic[mimic.mimicId] += 1
    ordinaryIncome += mimicConfigs[mimic.mimicId].baseReward
    if (source) defeats[source] += 1
    for (const id of mimic.effectCardIds) {
      pendingEvents.push({
        kind: 'card',
        id,
        readyAtMs: atMs + effectCardConfig.ejection.durationMs,
        chainDepth: chainDepth + 1,
      })
    }
  }

  const damageTargets = (
    targets: readonly BalanceCombatMimic[],
    damage: number,
    source: EffectCardId,
    atMs: number,
    chainDepth: number,
  ) => {
    for (const target of targets) {
      if (target.health === null || target.health <= 0) continue
      const appliedDamage = Math.min(target.health, damage)
      target.health -= appliedDamage
      attackHits[source] += 1
      additionalDamage[source] += appliedDamage
      if (target.health === 0) {
        defeatMimic(target, atMs, chainDepth, source)
      }
    }
  }

  const triggerThunder = (event: PendingCardEvent) => {
    const selectedMimics = new Set<number>()
    for (
      let strikeIndex = 0;
      strikeIndex < effectCardConfig.thunder.initialStrikeCount;
      strikeIndex += 1
    ) {
      const activeMimics = getActiveMimics(event.readyAtMs)
      const selected = selectThunderTarget(activeMimics, selectedMimics, random)
      thunderStrikesTriggered += 1
      if (!selected) continue
      selectedMimics.add(selected.id)
      damageTargets(
        collectThunderHitTargets(activeMimics, selected),
        calculateInitialThunderDamage(),
        'thunder',
        event.readyAtMs,
        event.chainDepth,
      )
    }
  }

  const triggerMeteorite = (event: PendingCardEvent) => {
    const offsets =
      event.meteoriteLaunchOffsetsMs ??
      createMeteoriteLaunchOffsets(
        effectCardConfig.meteorite.initialMeteoriteCount,
        random,
      )
    for (let index = 0; index < offsets.length; index += 1) {
      const offset = offsets[index]
      const launchAtMs = event.readyAtMs + offset
      if (launchAtMs >= roundConfig.durationMs) continue
      const landing =
        event.meteoriteLandings?.[index] ??
        selectMeteoriteLandingPoint(
          { width: field.widthPixels, height: field.heightPixels },
          random,
        )
      const trajectory = createMeteoriteTrajectory(
        { width: field.widthPixels, height: field.heightPixels },
        landing,
      )
      meteoritesLaunched += 1
      pendingEvents.push({
        kind: 'meteoriteImpact',
        impactAtMs:
          launchAtMs +
          trajectory.distance /
            effectCardConfig.meteorite.flightSpeedPixelsPerSecond *
            1_000,
        landing,
        chainDepth: event.chainDepth,
      })
    }
  }

  const processEvent = (event: PendingEffectEvent) => {
    if (event.kind === 'meteoriteImpact') {
      meteoriteImpacts += 1
      const activeMimics = getActiveMimics(event.impactAtMs)
      damageTargets(
        collectMeteoriteHitTargets(activeMimics, event.landing),
        calculateInitialMeteoriteDamage(),
        'meteorite',
        event.impactAtMs,
        event.chainDepth,
      )
      return
    }

    cardsTriggered[event.id] += 1
    maximumEffectChainDepth = Math.max(
      maximumEffectChainDepth,
      event.chainDepth,
    )
    if (event.id === 'thunder') triggerThunder(event)
    else triggerMeteorite(event)
  }

  const processEffectsThrough = (throughMs: number, inclusive = true) => {
    while (true) {
      pendingEvents.sort((first, second) => eventTime(first) - eventTime(second))
      const event = pendingEvents[0]
      if (
        !event ||
        eventTime(event) > throughMs ||
        (!inclusive && eventTime(event) === throughMs)
      ) {
        return
      }
      pendingEvents.shift()
      processEvent(event)
    }
  }

  const clickIntervalMs = 1_000 / (clickRate * accuracy)
  const clickCount = Math.floor(availableClickBudget)
  for (let clickIndex = 0; clickIndex < clickCount; clickIndex += 1) {
    const clickAtMs = (clickIndex + 1) * clickIntervalMs
    if (clickAtMs >= roundConfig.durationMs) break
    processEffectsThrough(clickAtMs)
    const target = getActiveMimics(clickAtMs)[0]
    if (!target || target.health === null) continue
    const interval = evaluateWeaponDamageInterval(
      target.nextWeaponDamageAllowedAtMs,
      clickAtMs,
    )
    if (!interval.isAllowed) continue
    target.nextWeaponDamageAllowedAtMs = interval.nextAllowedAtMs
    target.health = Math.max(
      0,
      target.health - combatConfig.initialWeaponDamage,
    )
    if (target.health === 0) defeatMimic(target, clickAtMs, 0, null)
  }
  processEffectsThrough(roundConfig.durationMs, false)

  return {
    defeatedByMimic,
    ordinaryIncome,
    cardsTriggered,
    attackHits,
    additionalDamage,
    defeats,
    thunderStrikesTriggered,
    meteoritesLaunched,
    meteoriteImpacts,
    maximumEffectChainDepth,
  }
}

function eventTime(event: PendingEffectEvent): number {
  if (event.kind === 'card') return event.readyAtMs
  return event.impactAtMs
}
