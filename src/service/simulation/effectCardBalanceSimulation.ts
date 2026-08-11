import { balanceSimulationConfig } from '../../configs/balanceSimulationConfig'
import { effectCardConfig } from '../../configs/effectCardConfig'
import { mimicConfigs } from '../../configs/mimicConfigs'
import { roundConfig } from '../../configs/roundConfig'
import { spawnConfig } from '../../configs/spawnConfig'
import type { MimicId, RandomSource } from '../../types/game'
import type { EffectCardId } from '../game/attachedCards/attachedCardRules'
import {
  calculateInitialMeteoriteDamage,
  calculateInitialThunderDamage,
  calculateInitialTornadoDamage,
} from '../game/effectCards/effectCardRules'
import {
  collectMeteoriteHitTargets,
} from '../game/effectCards/meteoriteRules'
import {
  collectThunderHitTargets,
  selectThunderTarget,
} from '../game/effectCards/thunderTargeting'
import {
  advanceTornadoRunMotion,
  advanceTornadoStraightMotion,
  clampTornadoSpawnPosition,
  collectTornadoHitTargets,
  createTornadoInitialDirections,
  selectTornadoTurnInterval,
} from '../game/effectCards/tornadoRules'
import { evaluateWeaponDamageInterval } from '../game/damage/weaponDamageInterval'
import { isEffectiveClearRefillTarget } from '../game/clearRefill/clearRefillTargets'
import { ClearRefillBalanceTracker } from './clearRefillBalanceSimulation'
import { EffectChainBalanceTracker } from './effectChainBalanceSimulation'
import { RingBalanceTracker } from './ringBalanceSimulation'
import { createSimulatedMeteoriteImpacts } from './meteoriteBalanceSimulation'
import { getInitialWeaponDefinition } from '../progression/weaponProgression'
import type {
  BalanceCombatMimic,
  EffectCardCombatMetrics,
  PendingCardEvent,
  PendingEffectEvent,
  SimulatedCombatMimic,
  SimulatedEffectCardEvent,
  SimulatedTornadoTick,
} from './effectCardBalanceTypes'

export type { BalanceCombatMimic, EffectCardCombatMetrics, SimulatedEffectCardEvent } from './effectCardBalanceTypes'

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
  weaponDamage: number = getInitialWeaponDefinition().baseDamage,
  ringCount = 0,
): EffectCardCombatMetrics {
  const mimics: SimulatedCombatMimic[] = sourceMimics.map((mimic) => ({
    ...mimic,
    effectCardIds: [...mimic.effectCardIds],
    isRefill: false,
    nextWeaponDamageAllowedAtMs: 0,
    weaponDamageTaken: 0,
  }))
  const defeatedByMimic = emptyMimicCounts()
  const cardsTriggered = emptyEffectCounts()
  const attackHits = emptyEffectCounts()
  const additionalDamage = emptyEffectCounts()
  const defeats = emptyEffectCounts()
  let nextChainId = 1
  const pendingEvents: PendingEffectEvent[] = scheduledCardEvents.map(
    (event) => ({
      ...event,
      kind: 'card',
      chainId: event.chainId ?? nextChainId++,
    }),
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
  let rare1SurvivorsAfterEffectResolution = 0
  let rare2SurvivorsAfterEffectResolution = 0
  let effectDefeatsAfterPriorWeaponDamage = 0
  const mimicPool = [...new Set(sourceMimics.map((mimic) => mimic.mimicId))]

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

  const getEffectiveMimics = (atMs: number) =>
    getActiveMimics(atMs).filter((mimic) =>
      isEffectiveClearRefillTarget(
        {
          bounds: {
            x: mimic.logicalX - spawnConfig.cardWidthPixels / 2,
            y: mimic.logicalY - spawnConfig.cardHeightPixels / 2,
            width: spawnConfig.cardWidthPixels,
            height: spawnConfig.cardHeightPixels,
          },
          health: mimic.health,
          jackpotPhase: mimic.jackpotPhase,
          role: mimic.role,
        },
        { x: 0, y: 0, width: field.widthPixels, height: field.heightPixels },
      ),
    )

  const getWeaponTarget = (atMs: number) => getActiveMimics(atMs)[0] ?? null

  const effectChainTracker = new EffectChainBalanceTracker(
    (atMs) => getEffectiveMimics(atMs).length,
  )
  const clearRefillTracker = new ClearRefillBalanceTracker({
    enqueueEvent: enqueueEffectEvent,
    field,
    getActiveMimics,
    getEffectiveMimics,
    markEffectChainFullClear: (chainId, atMs) =>
      effectChainTracker.markFullClear(chainId, atMs),
    mimicPool: mimicPool.length > 0 ? mimicPool : ['normal'],
    mimics,
    pendingEvents,
    random,
  })

  const defeatMimic = (
    mimic: SimulatedCombatMimic,
    atMs: number,
    chainDepth: number,
    source: EffectCardId | null,
    chainId: number | null,
  ): number | null => {
    defeatedByMimic[mimic.mimicId] += 1
    ordinaryIncome += mimicConfigs[mimic.mimicId].baseReward
    clearRefillTracker.recordDefeat(mimic)
    const resolvedChainId =
      chainId ?? (mimic.effectCardIds.length > 0 ? nextChainId++ : null)
    if (source) {
      defeats[source] += 1
      if (mimic.weaponDamageTaken > 0) effectDefeatsAfterPriorWeaponDamage += 1
      if (resolvedChainId !== null) {
        effectChainTracker.recordDefeat(resolvedChainId, mimic.id, atMs)
      }
    }
    for (const id of mimic.effectCardIds) {
      if (resolvedChainId === null) continue
      enqueueEffectEvent({
        kind: 'card',
        id,
        readyAtMs: atMs + effectCardConfig.ejection.durationMs,
        chainDepth: chainDepth + 1,
        chainId: resolvedChainId,
        sourcePosition: { x: mimic.logicalX, y: mimic.logicalY },
      })
    }
    return resolvedChainId
  }

  const damageTargets = (
    targets: readonly SimulatedCombatMimic[],
    damage: number,
    source: EffectCardId,
    atMs: number,
    chainDepth: number,
    chainId: number,
  ) => {
    for (const target of targets) {
      if (target.health === null || target.health <= 0) continue
      const appliedDamage = Math.min(target.health, damage)
      target.health -= appliedDamage
      attackHits[source] += 1
      additionalDamage[source] += appliedDamage
      if (target.health === 0) {
        defeatMimic(target, atMs, chainDepth, source, chainId)
      }
    }
    const remaining = getEffectiveMimics(atMs)
    rare1SurvivorsAfterEffectResolution += remaining.filter(
      (mimic) => mimic.mimicId === 'rare1',
    ).length
    rare2SurvivorsAfterEffectResolution += remaining.filter(
      (mimic) => mimic.mimicId === 'rare2',
    ).length
    clearRefillTracker.request(atMs, chainId)
  }

  const ringTracker = new RingBalanceTracker({
    damageTarget: (target, damage, atMs) => {
      target.health = Math.max(0, (target.health ?? 0) - damage)
      if (target.health !== 0) return
      const chainId = defeatMimic(target, atMs, 0, null, null)
      clearRefillTracker.request(atMs, chainId)
    },
    enqueueEvent: enqueueEffectEvent,
    getTarget: (targetId, atMs) =>
      getActiveMimics(atMs).find((mimic) => mimic.id === targetId) ?? null,
    ringCount,
  })

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
        event.chainId,
      )
    }
  }

  const triggerMeteorite = (event: PendingCardEvent) => {
    const impacts = createSimulatedMeteoriteImpacts({
      event,
      field: { width: field.widthPixels, height: field.heightPixels },
      getActiveMimics,
      random,
    })
    meteoritesLaunched += impacts.length
    for (const impact of impacts) {
      enqueueEffectEvent(impact)
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
        chainId: event.chainId,
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
      event.chainId,
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
    if (event.kind === 'ringStrike') {
      ringTracker.processStrike(event)
      return
    }
    if (event.kind === 'clearConfirmation') {
      clearRefillTracker.processConfirmation(event)
      return
    }
    if (event.kind === 'meteoriteImpact') {
      meteoriteImpacts += 1
      const activeMimics = getActiveMimics(event.impactAtMs)
      damageTargets(
        collectMeteoriteHitTargets(activeMimics, event.landing),
        calculateInitialMeteoriteDamage(),
        'meteorite',
        event.impactAtMs,
        event.chainDepth,
        event.chainId,
      )
      return
    }
    if (event.kind === 'tornadoTick') {
      processTornadoTick(event)
      return
    }

    effectChainTracker.ensure(event.chainId, event.readyAtMs)
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
      clearRefillTracker.unlockFinishedEffectChain()
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
    clearRefillTracker.notifyValidManualWeaponDamage()
    target.nextWeaponDamageAllowedAtMs = interval.nextAllowedAtMs
    const appliedWeaponDamage = Math.min(target.health, weaponDamage)
    target.weaponDamageTaken += appliedWeaponDamage
    target.health = Math.max(
      0,
      target.health - weaponDamage,
    )
    if (target.health === 0) {
      const chainId = defeatMimic(target, clickAtMs, 0, null, null)
      clearRefillTracker.request(clickAtMs, chainId)
    }
    ringTracker.recordAcceptedManualHit(clickAtMs, target.id, weaponDamage)
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
    ...effectChainTracker.createMetrics(),
    ...clearRefillTracker.createMetrics(),
    rare1SurvivorsAfterEffectResolution,
    rare2SurvivorsAfterEffectResolution,
    effectDefeatsAfterPriorWeaponDamage,
  }
}

function eventTime(event: PendingEffectEvent): number {
  if (event.kind === 'card') return event.readyAtMs
  if (event.kind === 'meteoriteImpact') return event.impactAtMs
  if (event.kind === 'clearConfirmation') return event.confirmAtMs
  if (event.kind === 'ringStrike') return event.strikeAtMs
  return event.tickAtMs
}
