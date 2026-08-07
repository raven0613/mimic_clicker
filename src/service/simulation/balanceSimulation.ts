import { balanceSimulationConfig } from '../../configs/balanceSimulationConfig'
import { combatConfig } from '../../configs/combatConfig'
import { jackpotConfig } from '../../configs/jackpotConfig'
import { mimicConfigs } from '../../configs/mimicConfigs'
import { roundConfig } from '../../configs/roundConfig'
import { spawnConfig } from '../../configs/spawnConfig'
import type { JackpotOutcome, MimicId, RectangleBounds } from '../../types/game'
import { calculateJackpotReward } from '../progression/progression'
import { selectSpawnPosition, selectWeightedMimicId } from '../spawn/spawn'
import { createSeededRandom } from './createSeededRandom'

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
  finished: boolean
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
): Pick<
  SimulatedRound,
  'generatedByMimic' | 'placementAttempts' | 'placementRejections'
> {
  const random = createSeededRandom(seed)
  const generatedByMimic = emptyMimicCounts()
  const activeBounds: Array<RectangleBounds & { updatedAtMs: number }> = []
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
    activeBounds.push({
      x: position.x,
      y: position.y,
      width: spawnConfig.cardWidthPixels,
      height: spawnConfig.cardHeightPixels,
      updatedAtMs: nextSpawnMs,
    })
    nextSpawnMs += roundConfig.regularSpawnIntervalMs
  }
  return { generatedByMimic, placementAttempts, placementRejections }
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
  const shellHits = Math.ceil(
    mimicConfigs[shellMimicId].maximumHealth / combatConfig.initialWeaponDamage,
  )
  const jackpotHits = Math.ceil(
    jackpotConfig.maximumHealth / combatConfig.initialWeaponDamage,
  )
  const jackpotRevealed = jackpotCase !== 'notRevealed' && landedClickBudget >= shellHits
  if (jackpotRevealed) landedClickBudget -= shellHits
  const chaseClickCapacity =
    jackpotConfig.chaseDurationMs * clickRate * accuracy / 1_000
  const jackpotDefeated =
    jackpotCase === 'defeated' &&
    jackpotRevealed &&
    chaseClickCapacity >= jackpotHits &&
    landedClickBudget >= jackpotHits
  if (jackpotDefeated) landedClickBudget -= jackpotHits

  const defeatedByMimic = emptyMimicCounts()
  let ordinaryIncome = 0
  for (const mimicId of pool) {
    const hitsPerDefeat = Math.ceil(
      mimicConfigs[mimicId].maximumHealth / combatConfig.initialWeaponDamage,
    )
    const possibleDefeats = Math.min(
      spawnMetrics.generatedByMimic[mimicId],
      Math.floor(landedClickBudget / hitsPerDefeat),
    )
    defeatedByMimic[mimicId] = possibleDefeats
    landedClickBudget -= possibleDefeats * hitsPerDefeat
    ordinaryIncome += possibleDefeats * mimicConfigs[mimicId].baseReward
  }

  return {
    stage,
    playerModel,
    accuracyModel,
    jackpotCase,
    ...spawnMetrics,
    defeatedByMimic,
    ordinaryIncome,
    jackpotIncome: jackpotDefeated ? calculateJackpotReward(pool) : 0,
    jackpotOpportunities:
      jackpotCase === 'notRevealed' ? calculateJackpotOpportunities() : 1,
    jackpotRevealed,
    jackpotDefeated,
    jackpotEscaped: jackpotRevealed && !jackpotDefeated,
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
    unfinishedRoundCount: rounds.filter((round) => !round.finished).length,
    summary: '',
  }
  report.summary = [
    `Balance ${report.configVersion}: ${report.caseCount} deterministic cases`,
    `placement rejection max ${(report.maximumPlacementRejectionRatio * 100).toFixed(1)}%`,
    `spawn share deviation max ${(report.maximumSpawnShareDeviation * 100).toFixed(1)}%`,
    `target defeats ${report.targetProfileAverageDefeatedMimics.toFixed(1)} mimics/round`,
    `target Jackpot defeat ${(report.targetProfileJackpotDefeatRate * 100).toFixed(1)}%`,
    `income ${Object.values(report.stageAverageTotalIncome).map((value) => value.toFixed(1)).join(' → ')}`,
  ].join(' | ')
  return report
}
