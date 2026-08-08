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
  selectEffectCardAssignments,
} from '../game/effectCards/effectCardRules'
import { createSeededRandom } from './createSeededRandom'
import {
  simulateEffectCardCombat,
  type BalanceCombatMimic,
} from './effectCardBalanceSimulation'

type StageKey = 'normalOnly' | 'normalRare1' | 'allMimics'
type PlayerModel = keyof typeof balanceSimulationConfig.playerClickRatesPerSecond
type AccuracyModel = keyof typeof balanceSimulationConfig.accuracyRates

interface SimulatedRound {
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
  effectCardsGenerated: number
  thunderStrikesTriggered: number
  thunderDefeats: number
  maximumThunderChainDepth: number
  finished: boolean
}

interface SpawnStreamMetrics {
  generatedByMimic: Record<MimicId, number>
  placementAttempts: number
  placementRejections: number
  spawnedMimics: BalanceCombatMimic[]
}

export interface BalanceSimulationReport {
  configVersion: string
  caseCount: number
  maximumPlacementRejectionRatio: number
  maximumSpawnShareDeviation: number
  targetProfileAverageDefeatedMimics: number
  targetProfileJackpotDefeatRate: number
  stageAverageTotalIncome: Record<StageKey, number>
  stageAverageGeneratedMimics: Record<StageKey, number>
  stageAverageDefeatedMimics: Record<StageKey, number>
  mimicDefeatTimeMs: Record<MimicId, { average: number; p90: number }>
  jackpotMetrics: {
    averageOpportunities: number
    revealRate: number
    defeatRate: number
    escapeRate: number
  }
  effectCardMetrics: {
    carrierRate: number
    strikesTriggered: number
    thunderDefeats: number
    maximumChainDepth: number
  }
  unfinishedRoundCount: number
  summary: string
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
    const hasThunderCard = selectEffectCardAssignments(
      false,
      attachedCardConfig.capacity.byMimic[mimicId],
      random,
    ).some(({ id }) => id === 'thunder')
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
      hasThunderCard,
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
  const shellHasThunderCard = selectEffectCardAssignments(
    false,
    attachedCardConfig.capacity.byMimic[shellMimicId],
    random,
  ).some(({ id }) => id === 'thunder')
  const shellHits = Math.ceil(
    mimicConfigs[shellMimicId].maximumHealth / combatConfig.initialWeaponDamage,
  )
  const jackpotRevealed =
    jackpotCase !== 'notRevealed' && landedClickBudget >= shellHits
  if (jackpotRevealed) landedClickBudget -= shellHits
  const jackpotHasThunderCard =
    jackpotRevealed &&
    selectEffectCardAssignments(
      false,
      attachedCardConfig.capacity.jackpot.maximum,
      random,
    ).some(({ id }) => id === 'thunder')
  const shellDefeatAtMs =
    roundConfig.initialJackpotSpawnDelayMs +
    (shellHits / (clickRate * accuracy)) * 1_000
  const regularTargetsAtReveal = spawnMetrics.spawnedMimics.filter(
    (mimic) => mimic.spawnedAtMs <= shellDefeatAtMs,
  ).length
  const shellThunderHitsJackpot =
    jackpotRevealed &&
    shellHasThunderCard &&
    Math.floor(random() * (regularTargetsAtReveal + 1)) ===
      regularTargetsAtReveal
  const jackpotHealthBeforeClicks = Math.max(
    0,
    jackpotConfig.maximumHealth -
      (shellThunderHitsJackpot ? calculateInitialThunderDamage() : 0),
  )
  const jackpotHits = Math.ceil(
    jackpotHealthBeforeClicks / combatConfig.initialWeaponDamage,
  )
  const chaseClickCapacity =
    jackpotConfig.chaseDurationMs * clickRate * accuracy / 1_000
  const jackpotDefeated =
    jackpotCase === 'defeated' &&
    jackpotRevealed &&
    chaseClickCapacity >= jackpotHits &&
    landedClickBudget >= jackpotHits
  if (jackpotDefeated) landedClickBudget -= jackpotHits

  const scheduledThunderEvents = []
  if (jackpotRevealed && shellHasThunderCard && !shellThunderHitsJackpot) {
    scheduledThunderEvents.push({
      readyAtMs: shellDefeatAtMs + effectCardConfig.ejection.durationMs,
      chainDepth: 1,
    })
  }
  if (jackpotDefeated && jackpotHasThunderCard) {
    const jackpotDefeatAtMs =
      shellDefeatAtMs + (jackpotHits / (clickRate * accuracy)) * 1_000
    scheduledThunderEvents.push({
      readyAtMs: jackpotDefeatAtMs + effectCardConfig.ejection.durationMs,
      chainDepth: 1,
    })
  }

  const combatMetrics = simulateEffectCardCombat(
    spawnMetrics.spawnedMimics,
    landedClickBudget,
    clickRate,
    accuracy,
    random,
    scheduledThunderEvents,
  )
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
    effectCardEligibleSpawns:
      spawnMetrics.spawnedMimics.length + 1 + Number(jackpotRevealed),
    effectCardsGenerated:
      spawnMetrics.spawnedMimics.filter((mimic) => mimic.hasThunderCard).length +
      Number(shellHasThunderCard) + Number(jackpotHasThunderCard),
    thunderStrikesTriggered:
      combatMetrics.thunderStrikesTriggered +
      Number(shellThunderHitsJackpot) *
        effectCardConfig.thunder.initialStrikeCount,
    finished: true,
  }
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function percentile(values: number[], ratio: number): number {
  const sorted = [...values].sort((first, second) => first - second)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))]
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

  const stageAverageTotalIncome = {} as Record<StageKey, number>
  const stageAverageGeneratedMimics = {} as Record<StageKey, number>
  const stageAverageDefeatedMimics = {} as Record<StageKey, number>
  for (const stage of Object.keys(stagePools) as StageKey[]) {
    const stageRounds = rounds.filter((round) => round.stage === stage)
    stageAverageTotalIncome[stage] = average(
      stageRounds.map((round) => round.ordinaryIncome + round.jackpotIncome),
    )
    stageAverageGeneratedMimics[stage] = average(
      stageRounds.map((round) =>
        Object.values(round.generatedByMimic).reduce((sum, value) => sum + value, 0),
      ),
    )
    stageAverageDefeatedMimics[stage] = average(
      stageRounds.map((round) =>
        Object.values(round.defeatedByMimic).reduce((sum, value) => sum + value, 0),
      ),
    )
  }

  let maximumSpawnShareDeviation = 0
  for (const stage of Object.keys(stagePools) as StageKey[]) {
    const pool = stagePools[stage]
    const stageRounds = rounds.filter((round) => round.stage === stage)
    const totalGenerated = stageRounds.reduce(
      (sum, round) =>
        sum + Object.values(round.generatedByMimic).reduce((a, b) => a + b, 0),
      0,
    )
    const totalWeight = pool.reduce(
      (sum, mimicId) => sum + mimicConfigs[mimicId].spawnWeight,
      0,
    )
    for (const mimicId of pool) {
      const actual =
        stageRounds.reduce(
          (sum, round) => sum + round.generatedByMimic[mimicId],
          0,
        ) / totalGenerated
      const expected = mimicConfigs[mimicId].spawnWeight / totalWeight
      maximumSpawnShareDeviation = Math.max(
        maximumSpawnShareDeviation,
        Math.abs(actual - expected),
      )
    }
  }

  const defeatTimes = {} as BalanceSimulationReport['mimicDefeatTimeMs']
  for (const mimicId of Object.keys(mimicConfigs) as MimicId[]) {
    const times: number[] = []
    for (const clickRate of Object.values(
      balanceSimulationConfig.playerClickRatesPerSecond,
    )) {
      for (const accuracy of Object.values(balanceSimulationConfig.accuracyRates)) {
        times.push(
          Math.ceil(
            mimicConfigs[mimicId].maximumHealth /
              combatConfig.initialWeaponDamage,
          ) /
            (clickRate * accuracy) *
            1_000,
        )
      }
    }
    defeatTimes[mimicId] = { average: average(times), p90: percentile(times, 0.9) }
  }

  const targetRounds = rounds.filter(
    (round) =>
      round.playerModel === 'target' && round.accuracyModel === 'target',
  )
  const targetDefeatRounds = targetRounds.filter(
    (round) => round.jackpotCase === 'defeated',
  )
  const allEffectCardEligibleSpawns = rounds.reduce(
    (sum, round) => sum + round.effectCardEligibleSpawns,
    0,
  )
  const report: BalanceSimulationReport = {
    configVersion: balanceSimulationConfig.configVersion,
    caseCount: rounds.length,
    maximumPlacementRejectionRatio: Math.max(
      ...rounds.map((round) => round.placementRejections / round.placementAttempts),
    ),
    maximumSpawnShareDeviation,
    targetProfileAverageDefeatedMimics: average(
      targetRounds.map((round) =>
        Object.values(round.defeatedByMimic).reduce((sum, value) => sum + value, 0),
      ),
    ),
    targetProfileJackpotDefeatRate: average(
      targetDefeatRounds.map((round) => Number(round.jackpotDefeated)),
    ),
    stageAverageTotalIncome,
    stageAverageGeneratedMimics,
    stageAverageDefeatedMimics,
    mimicDefeatTimeMs: defeatTimes,
    jackpotMetrics: {
      averageOpportunities: average(rounds.map((round) => round.jackpotOpportunities)),
      revealRate: average(rounds.map((round) => Number(round.jackpotRevealed))),
      defeatRate: average(rounds.map((round) => Number(round.jackpotDefeated))),
      escapeRate: average(rounds.map((round) => Number(round.jackpotEscaped))),
    },
    effectCardMetrics: {
      carrierRate:
        rounds.reduce((sum, round) => sum + round.effectCardsGenerated, 0) /
        allEffectCardEligibleSpawns,
      strikesTriggered: rounds.reduce(
        (sum, round) => sum + round.thunderStrikesTriggered,
        0,
      ),
      thunderDefeats: rounds.reduce(
        (sum, round) => sum + round.thunderDefeats,
        0,
      ),
      maximumChainDepth: Math.max(
        ...rounds.map((round) => round.maximumThunderChainDepth),
      ),
    },
    unfinishedRoundCount: rounds.filter((round) => !round.finished).length,
    summary: '',
  }
  report.summary = [
    `Balance ${report.configVersion}: ${report.caseCount} deterministic cases`,
    `placement rejection max ${(report.maximumPlacementRejectionRatio * 100).toFixed(1)}%`,
    `spawn share deviation max ${(report.maximumSpawnShareDeviation * 100).toFixed(1)}%`,
    `target defeats ${report.targetProfileAverageDefeatedMimics.toFixed(1)} mimics/round`,
    `target Jackpot defeat ${(report.targetProfileJackpotDefeatRate * 100).toFixed(1)}%`,
    `Thunder ${(report.effectCardMetrics.carrierRate * 100).toFixed(1)}% carriers / ${report.effectCardMetrics.thunderDefeats} defeats / chain ${report.effectCardMetrics.maximumChainDepth}`,
    `income ${Object.values(report.stageAverageTotalIncome).map((value) => value.toFixed(1)).join(' → ')}`,
  ].join(' | ')
  return report
}
