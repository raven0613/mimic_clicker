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
  calculateInitialTornadoDamage,
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
import {
  advanceTornadoRunMotion,
  advanceTornadoStraightMotion,
  clampTornadoSpawnPosition,
  collectTornadoHitTargets,
  createTornadoInitialDirections,
  selectTornadoTurnInterval,
  type TornadoMotionState,
} from '../game/effectCards/tornadoRules'
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
  sourcePosition?: Vector2
}

interface SimulatedMeteoriteImpact {
  kind: 'meteoriteImpact'
  impactAtMs: number
  landing: Vector2
  chainDepth: number
}

interface SimulatedTornadoTick {
  kind: 'tornadoTick'
  tickAtMs: number
  runEndsAtMs: number
  motion: TornadoMotionState
  nextDamageAllowedAtMsByTarget: Map<number, number>
  chainDepth: number
}

interface PendingCardEvent extends SimulatedEffectCardEvent {
  kind: 'card'
}

type PendingEffectEvent =
  | PendingCardEvent
  | SimulatedMeteoriteImpact
  | SimulatedTornadoTick

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
  tornadoesSpawned: number
  maximumEffectChainDepth: number
}

const field = balanceSimulationConfig.field

function emptyMimicCounts(): Record<MimicId, number> {
  return { normal: 0, rare1: 0, rare2: 0 }
}

function emptyEffectCounts(): Record<EffectCardId, number> {
  return { thunder: 0, meteorite: 0, tornado: 0 }
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
  pendingEvents.sort((first, second) => eventTime(first) - eventTime(second))
  const enqueueEffectEvent = (event: PendingEffectEvent) => {
    let lower = 0
    let upper = pendingEvents.length
    const time = eventTime(event)
    while (lower < upper) {
      const middle = Math.floor((lower + upper) / 2)
      if (eventTime(pendingEvents[middle]) <= time) lower = middle + 1
      else upper = middle
    }
    pendingEvents.splice(lower, 0, event)
  }
  const movementSpeed =
    (field.heightPixels + spawnConfig.cardHeightPixels * 2) /
    (roundConfig.mimicFieldTravelDurationMs / 1_000)
  let ordinaryIncome = 0
  let thunderStrikesTriggered = 0
  let meteoritesLaunched = 0
  let meteoriteImpacts = 0
  let tornadoesSpawned = 0
  let maximumEffectChainDepth = 0
  let nextWeaponTargetIndex = 0

  const getActiveMimics = (atMs: number) =>
    mimics.filter((mimic) => {
      if (
        mimic.spawnedAtMs > atMs ||
        mimic.health === null ||
        mimic.health <= 0
      ) {
        return false
      }
      mimic.logicalY =
        mimic.initialY + movementSpeed * ((atMs - mimic.spawnedAtMs) / 1_000)
      return (
        mimic.logicalY - spawnConfig.cardHeightPixels / 2 <=
        field.heightPixels
      )
    })

  const getWeaponTarget = (atMs: number) => {
    while (nextWeaponTargetIndex < mimics.length) {
      const mimic = mimics[nextWeaponTargetIndex]
      if (mimic.spawnedAtMs > atMs) return null
      mimic.logicalY =
        mimic.initialY + movementSpeed * ((atMs - mimic.spawnedAtMs) / 1_000)
      const hasExited =
        mimic.logicalY - spawnConfig.cardHeightPixels / 2 > field.heightPixels
      if (hasExited || mimic.health === null || mimic.health <= 0) {
        nextWeaponTargetIndex += 1
        continue
      }
      return mimic
    }
    return null
  }

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
      enqueueEffectEvent({
        kind: 'card',
        id,
        readyAtMs: atMs + effectCardConfig.ejection.durationMs,
        chainDepth: chainDepth + 1,
        sourcePosition: { x: mimic.logicalX, y: mimic.logicalY },
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
      enqueueEffectEvent({
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

  const triggerTornado = (event: PendingCardEvent) => {
    const source = event.sourcePosition ?? {
      x: field.widthPixels / 2,
      y: field.heightPixels / 2,
    }
    const fieldSize = {
      width: field.widthPixels,
      height: field.heightPixels,
    }
    const startPosition = clampTornadoSpawnPosition(source, fieldSize)
    const runStartsAtMs =
      event.readyAtMs + effectCardConfig.tornado.startAnimationDurationMs
    const runEndsAtMs = runStartsAtMs + effectCardConfig.tornado.runDurationMs
    for (const direction of createTornadoInitialDirections(
      effectCardConfig.tornado.initialTornadoCount,
      random,
    )) {
      tornadoesSpawned += 1
      if (runStartsAtMs >= roundConfig.durationMs) continue
      const afterStart = advanceTornadoStraightMotion(
        { position: startPosition, direction },
        effectCardConfig.tornado.startAnimationDurationMs,
        fieldSize,
      )
      enqueueEffectEvent({
        kind: 'tornadoTick',
        tickAtMs: runStartsAtMs,
        runEndsAtMs,
        motion: {
          ...afterStart,
          remainingTurnMs: selectTornadoTurnInterval(random),
        },
        nextDamageAllowedAtMsByTarget: new Map(),
        chainDepth: event.chainDepth,
      })
    }
  }

  const processTornadoTick = (event: SimulatedTornadoTick) => {
    const activeMimics = getActiveMimics(event.tickAtMs)
    const hitTargets = collectTornadoHitTargets(
      activeMimics,
      event.motion.position,
    ).filter(
      (target) =>
        event.tickAtMs >=
        (event.nextDamageAllowedAtMsByTarget.get(target.id) ?? 0),
    )
    for (const target of hitTargets) {
      event.nextDamageAllowedAtMsByTarget.set(
        target.id,
        event.tickAtMs + effectCardConfig.tornado.damageIntervalPerTargetMs,
      )
    }
    damageTargets(
      hitTargets,
      calculateInitialTornadoDamage(),
      'tornado',
      event.tickAtMs,
      event.chainDepth,
    )

    const nextTickAtMs = Math.min(
      event.tickAtMs + effectCardConfig.tornado.damageIntervalPerTargetMs,
      event.runEndsAtMs,
    )
    if (
      nextTickAtMs >= event.runEndsAtMs ||
      nextTickAtMs >= roundConfig.durationMs
    ) {
      return
    }
    enqueueEffectEvent({
      ...event,
      tickAtMs: nextTickAtMs,
      motion: advanceTornadoRunMotion(
        event.motion,
        nextTickAtMs - event.tickAtMs,
        { width: field.widthPixels, height: field.heightPixels },
        random,
      ),
    })
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
    if (event.kind === 'tornadoTick') {
      processTornadoTick(event)
      return
    }

    cardsTriggered[event.id] += 1
    maximumEffectChainDepth = Math.max(
      maximumEffectChainDepth,
      event.chainDepth,
    )
    if (event.id === 'thunder') {
      triggerThunder(event)
      return
    }
    if (event.id === 'meteorite') {
      triggerMeteorite(event)
      return
    }
    triggerTornado(event)
  }

  const processEffectsThrough = (throughMs: number, inclusive = true) => {
    while (true) {
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
    const target = getWeaponTarget(clickAtMs)
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
    tornadoesSpawned,
    maximumEffectChainDepth,
  }
}

function eventTime(event: PendingEffectEvent): number {
  if (event.kind === 'card') return event.readyAtMs
  if (event.kind === 'meteoriteImpact') return event.impactAtMs
  return event.tickAtMs
}
