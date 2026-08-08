import { balanceSimulationConfig } from '../../configs/balanceSimulationConfig'
import { attachedCardConfig } from '../../configs/attachedCardConfig'
import { combatConfig } from '../../configs/combatConfig'
import { effectCardConfig } from '../../configs/effectCardConfig'
import { jackpotConfig } from '../../configs/jackpotConfig'
import { mimicConfigs } from '../../configs/mimicConfigs'
import { roundConfig } from '../../configs/roundConfig'
import { spawnConfig } from '../../configs/spawnConfig'
import type { JackpotOutcome, MimicId, RectangleBounds } from '../../types/game'
import { calculateJackpotReward } from '../progression/progression'
import { selectSpawnPosition, selectWeightedMimicId } from '../spawn/spawn'
import {
  calculateInitialThunderDamage,
  calculateInitialMeteoriteDamage,
  selectEffectCardAssignments,
  selectJackpotEffectCardAssignments,
  type EffectCardId,
} from '../game/effectCards/effectCardRules'
import {
  collectMeteoriteHitTargets,
  createMeteoriteLaunchOffsets,
  createMeteoriteTrajectory,
  selectMeteoriteLandingPoint,
} from '../game/effectCards/meteoriteRules'
import { createSeededRandom } from './createSeededRandom'
import {
  createBalanceSimulationReport,
  type BalanceSimulationReport,
} from './balanceSimulationReport'
import {
  simulateEffectCardCombat,
  type BalanceCombatMimic,
} from './effectCardBalanceSimulation'
import { simulateRequiredWeaponHits } from './weaponAttackSimulation'

export type StageKey = 'normalOnly' | 'normalRare1' | 'allMimics'
type PlayerModel = keyof typeof balanceSimulationConfig.playerClickRatesPerSecond
type AccuracyModel = keyof typeof balanceSimulationConfig.accuracyRates

export interface SimulatedRound {
  stage: StageKey
  playerModel: PlayerModel
  accuracyModel: AccuracyModel
  jackpotCase: JackpotOutcome
  generatedByMimic: Record<MimicId, number>
  defeatedByMimic: Record<MimicId, number>
  placementAttempts: number
  placementRejections: number
  ordinaryIncome: number
  jackpotIncome: number
  jackpotOpportunities: number
  jackpotRevealed: boolean
  jackpotDefeated: boolean
  jackpotEscaped: boolean
  effectCardEligibleSpawns: number
  chanceEffectCardsGenerated: Record<EffectCardId, number>
  effectCardsGenerated: Record<EffectCardId, number>
  cardsTriggered: Record<EffectCardId, number>
  attackHits: Record<EffectCardId, number>
  additionalDamage: Record<EffectCardId, number>
  effectDefeats: Record<EffectCardId, number>
  thunderStrikesTriggered: number
  meteoritesLaunched: number
  meteoriteImpacts: number
  maximumEffectChainDepth: number
  finished: boolean
}

interface SpawnStreamMetrics {
  generatedByMimic: Record<MimicId, number>
  placementAttempts: number
  placementRejections: number
  spawnedMimics: BalanceCombatMimic[]
}

const stagePools: Record<StageKey, MimicId[]> = {
  normalOnly: ['normal'],
  normalRare1: ['normal', 'rare1'],
  allMimics: ['normal', 'rare1', 'rare2'],
}

function emptyMimicCounts(): Record<MimicId, number> {
  return { normal: 0, rare1: 0, rare2: 0 }
}

function simulateSpawnStream(
  pool: MimicId[],
  seed: number,
): SpawnStreamMetrics {
  const random = createSeededRandom(seed)
  const generatedByMimic = emptyMimicCounts()
  const activeBounds: Array<RectangleBounds & { updatedAtMs: number }> = []
  const spawnedMimics: BalanceCombatMimic[] = []
  const movementSpeed =
    (balanceSimulationConfig.field.heightPixels +
      spawnConfig.cardHeightPixels * 2) /
    (roundConfig.mimicFieldTravelDurationMs / 1_000)
  let nextSpawnMs = roundConfig.initialSpawnDelayMs
  let placementAttempts = 0
  let placementRejections = 0

  while (nextSpawnMs < roundConfig.durationMs) {
    for (const bounds of activeBounds) {
      bounds.y += movementSpeed * ((nextSpawnMs - bounds.updatedAtMs) / 1_000)
      bounds.updatedAtMs = nextSpawnMs
    }
    for (let index = activeBounds.length - 1; index >= 0; index -= 1) {
      if (activeBounds[index].y > balanceSimulationConfig.field.heightPixels) {
        activeBounds.splice(index, 1)
      }
    }

    placementAttempts += 1
    const spawnY = -spawnConfig.cardHeightPixels + spawnConfig.spawnYInsetPixels
    const position = selectSpawnPosition(
      {
        fieldWidth: balanceSimulationConfig.field.widthPixels,
        cardWidth: spawnConfig.cardWidthPixels,
        cardHeight: spawnConfig.cardHeightPixels,
        spawnY,
        occupiedBounds: activeBounds,
      },
      random,
    )
    if (!position) {
      placementRejections += 1
      nextSpawnMs += spawnConfig.retryDelayMs
      continue
    }

    const mimicId = selectWeightedMimicId(pool, random)
    generatedByMimic[mimicId] += 1
    const effectCardIds = selectEffectCardAssignments(
      false,
      attachedCardConfig.capacity.byMimic[mimicId],
      random,
    ).map(({ id }) => id)
    spawnedMimics.push({
      id: spawnedMimics.length,
      mimicId,
      role: 'regular',
      health: mimicConfigs[mimicId].maximumHealth,
      logicalX: position.x + spawnConfig.cardWidthPixels / 2,
      logicalY: position.y + spawnConfig.cardHeightPixels / 2,
      jackpotPhase: null,
      spawnedAtMs: nextSpawnMs,
      initialY: position.y + spawnConfig.cardHeightPixels / 2,
      effectCardIds,
    })
    activeBounds.push({
      x: position.x,
      y: position.y,
      width: spawnConfig.cardWidthPixels,
      height: spawnConfig.cardHeightPixels,
      updatedAtMs: nextSpawnMs,
    })
    nextSpawnMs += roundConfig.regularSpawnIntervalMs
  }
  return {
    generatedByMimic,
    placementAttempts,
    placementRejections,
    spawnedMimics,
  }
}

function calculateJackpotOpportunities(): number {
  let opportunities = 0
  let appearanceMs = roundConfig.initialJackpotSpawnDelayMs
  while (appearanceMs < roundConfig.durationMs) {
    opportunities += 1
    appearanceMs +=
      roundConfig.mimicFieldTravelDurationMs +
      roundConfig.jackpotReturnBaseDelayMs +
      opportunities * roundConfig.jackpotReturnAdditionalDelayPerMissMs
  }
  return opportunities
}

function simulateRound(
  stage: StageKey,
  playerModel: PlayerModel,
  accuracyModel: AccuracyModel,
  jackpotCase: JackpotOutcome,
  seed: number,
): SimulatedRound {
  const pool = stagePools[stage]
  const spawnMetrics = simulateSpawnStream(pool, seed)
  const random = createSeededRandom(seed ^ 0x9e3779b9)
  const clickRate = balanceSimulationConfig.playerClickRatesPerSecond[playerModel]
  const accuracy = balanceSimulationConfig.accuracyRates[accuracyModel]
  let landedClickBudget = roundConfig.durationMs * clickRate * accuracy / 1_000
  const shellMimicId = selectWeightedMimicId(pool, random)
  const shellEffectCardIds = selectEffectCardAssignments(
    false,
    attachedCardConfig.capacity.byMimic[shellMimicId],
    random,
  ).map(({ id }) => id)
  const shellHasThunderCard = shellEffectCardIds.includes('thunder')
  const shellHits = Math.ceil(
    mimicConfigs[shellMimicId].maximumHealth / combatConfig.initialWeaponDamage,
  )
  const weaponAttemptIntervalMs = 1_000 / (clickRate * accuracy)
  const shellWeaponAttacks = simulateRequiredWeaponHits(
    shellHits,
    roundConfig.initialJackpotSpawnDelayMs,
    weaponAttemptIntervalMs,
    0,
  )
  const jackpotRevealed =
    jackpotCase !== 'notRevealed' &&
    shellWeaponAttacks.completedAtMs < roundConfig.durationMs &&
    landedClickBudget >= shellWeaponAttacks.attemptCount
  if (jackpotRevealed) {
    landedClickBudget -= shellWeaponAttacks.attemptCount
  }
  const jackpotEffectCardIds = jackpotRevealed
    ? selectJackpotEffectCardAssignments(random).map(({ id }) => id)
    : []
  const shellDefeatAtMs = shellWeaponAttacks.completedAtMs
  const regularTargetsAtReveal = spawnMetrics.spawnedMimics.filter(
    (mimic) => mimic.spawnedAtMs <= shellDefeatAtMs,
  ).length
  const shellThunderHitsJackpot =
    jackpotRevealed &&
    shellHasThunderCard &&
    Math.floor(random() * (regularTargetsAtReveal + 1)) ===
      regularTargetsAtReveal
  const shellMeteoriteLaunchOffsets = shellEffectCardIds.includes('meteorite')
    ? createMeteoriteLaunchOffsets(
        effectCardConfig.meteorite.initialMeteoriteCount,
        random,
      )
    : []
  const shellMeteoriteLandings = shellMeteoriteLaunchOffsets.map(() =>
    selectMeteoriteLandingPoint(
      {
        width: balanceSimulationConfig.field.widthPixels,
        height: balanceSimulationConfig.field.heightPixels,
      },
      random,
    ),
  )
  const jackpotTarget = {
    id: -1,
    role: 'jackpot' as const,
    health: jackpotConfig.maximumHealth,
    logicalX: balanceSimulationConfig.field.widthPixels / 2,
    logicalY: balanceSimulationConfig.field.heightPixels / 2,
    jackpotPhase: 'chasing' as const,
  }
  const shellMeteoriteHitsJackpot = shellMeteoriteLandings.filter(
    (landing, index) => {
      const trajectory = createMeteoriteTrajectory(
        {
          width: balanceSimulationConfig.field.widthPixels,
          height: balanceSimulationConfig.field.heightPixels,
        },
        landing,
      )
      const impactDelayMs =
        effectCardConfig.ejection.durationMs +
        shellMeteoriteLaunchOffsets[index] +
        (trajectory.distance /
          effectCardConfig.meteorite.flightSpeedPixelsPerSecond) *
          1_000
      return (
        impactDelayMs < jackpotConfig.chaseDurationMs &&
        collectMeteoriteHitTargets([jackpotTarget], landing).length > 0
      )
    },
  ).length
  const jackpotHealthBeforeClicks = Math.max(
    0,
    jackpotConfig.maximumHealth -
      (shellThunderHitsJackpot ? calculateInitialThunderDamage() : 0) -
      shellMeteoriteHitsJackpot * calculateInitialMeteoriteDamage(),
  )
  const jackpotHits = Math.ceil(
    jackpotHealthBeforeClicks / combatConfig.initialWeaponDamage,
  )
  const jackpotWeaponAttacks = simulateRequiredWeaponHits(
    jackpotHits,
    shellDefeatAtMs,
    weaponAttemptIntervalMs,
    shellWeaponAttacks.nextAllowedAtMs,
  )
  const jackpotDefeated =
    jackpotCase === 'defeated' &&
    jackpotRevealed &&
    jackpotWeaponAttacks.completedAtMs - shellDefeatAtMs <=
      jackpotConfig.chaseDurationMs &&
    landedClickBudget >= jackpotWeaponAttacks.attemptCount
  if (jackpotDefeated) {
    landedClickBudget -= jackpotWeaponAttacks.attemptCount
  }

  const scheduledCardEvents = []
  if (jackpotRevealed) {
    for (const id of shellEffectCardIds) {
      if (id === 'thunder' && shellThunderHitsJackpot) continue
      scheduledCardEvents.push({
        id,
        readyAtMs: shellDefeatAtMs + effectCardConfig.ejection.durationMs,
        chainDepth: 1,
        meteoriteLandings:
          id === 'meteorite' ? shellMeteoriteLandings : undefined,
        meteoriteLaunchOffsetsMs:
          id === 'meteorite' ? shellMeteoriteLaunchOffsets : undefined,
      })
    }
  }
  if (jackpotDefeated) {
    const jackpotDefeatAtMs = jackpotWeaponAttacks.completedAtMs
    for (const id of jackpotEffectCardIds) {
      scheduledCardEvents.push({
        id,
        readyAtMs: jackpotDefeatAtMs + effectCardConfig.ejection.durationMs,
        chainDepth: 1,
      })
    }
  }

  const combatMetrics = simulateEffectCardCombat(
    spawnMetrics.spawnedMimics,
    landedClickBudget,
    clickRate,
    accuracy,
    random,
    scheduledCardEvents,
  )
  const generatedEffectCardIds = [
    ...spawnMetrics.spawnedMimics.flatMap((mimic) => mimic.effectCardIds),
    ...shellEffectCardIds,
    ...jackpotEffectCardIds,
  ]
  const chanceGeneratedEffectCardIds = [
    ...spawnMetrics.spawnedMimics.flatMap((mimic) => mimic.effectCardIds),
    ...shellEffectCardIds,
  ]
  const directThunderHit = Number(shellThunderHitsJackpot)
  const directMeteoriteHits = shellMeteoriteHitsJackpot
  const cardsTriggered = {
    ...combatMetrics.cardsTriggered,
    thunder: combatMetrics.cardsTriggered.thunder + directThunderHit,
  }
  const attackHits = {
    ...combatMetrics.attackHits,
    thunder: combatMetrics.attackHits.thunder + directThunderHit,
    meteorite: combatMetrics.attackHits.meteorite + directMeteoriteHits,
  }
  const additionalDamage = {
    ...combatMetrics.additionalDamage,
    thunder:
      combatMetrics.additionalDamage.thunder +
      directThunderHit * calculateInitialThunderDamage(),
    meteorite:
      combatMetrics.additionalDamage.meteorite +
      directMeteoriteHits * calculateInitialMeteoriteDamage(),
  }
  return {
    stage,
    playerModel,
    accuracyModel,
    jackpotCase,
    generatedByMimic: spawnMetrics.generatedByMimic,
    placementAttempts: spawnMetrics.placementAttempts,
    placementRejections: spawnMetrics.placementRejections,
    ...combatMetrics,
    jackpotIncome: jackpotDefeated ? calculateJackpotReward(pool) : 0,
    jackpotOpportunities:
      jackpotCase === 'notRevealed' ? calculateJackpotOpportunities() : 1,
    jackpotRevealed,
    jackpotDefeated,
    jackpotEscaped: jackpotRevealed && !jackpotDefeated,
    effectCardEligibleSpawns: spawnMetrics.spawnedMimics.length + 1,
    chanceEffectCardsGenerated: countEffectCards(
      chanceGeneratedEffectCardIds,
    ),
    effectCardsGenerated: countEffectCards(generatedEffectCardIds),
    cardsTriggered,
    attackHits,
    additionalDamage,
    effectDefeats: combatMetrics.defeats,
    thunderStrikesTriggered:
      combatMetrics.thunderStrikesTriggered +
      Number(shellThunderHitsJackpot) *
        effectCardConfig.thunder.initialStrikeCount,
    meteoritesLaunched: combatMetrics.meteoritesLaunched,
    meteoriteImpacts: combatMetrics.meteoriteImpacts,
    maximumEffectChainDepth: combatMetrics.maximumEffectChainDepth,
    finished: true,
  }
}

function countEffectCards(ids: readonly EffectCardId[]): Record<EffectCardId, number> {
  return {
    thunder: ids.filter((id) => id === 'thunder').length,
    meteorite: ids.filter((id) => id === 'meteorite').length,
  }
}

export function runBalanceSimulation(): BalanceSimulationReport {
  const rounds: SimulatedRound[] = []
  for (const stage of Object.keys(stagePools) as StageKey[]) {
    for (const playerModel of Object.keys(
      balanceSimulationConfig.playerClickRatesPerSecond,
    ) as PlayerModel[]) {
      for (const accuracyModel of Object.keys(
        balanceSimulationConfig.accuracyRates,
      ) as AccuracyModel[]) {
        for (const jackpotCase of balanceSimulationConfig.jackpotCases) {
          for (const seed of balanceSimulationConfig.seeds) {
            rounds.push(
              simulateRound(stage, playerModel, accuracyModel, jackpotCase, seed),
            )
          }
        }
      }
    }
  }

  return createBalanceSimulationReport(rounds, stagePools)
}

export type { BalanceSimulationReport } from './balanceSimulationReport'
