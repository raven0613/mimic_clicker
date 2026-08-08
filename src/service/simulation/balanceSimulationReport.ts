import { balanceSimulationConfig } from '../../configs/balanceSimulationConfig'
import { combatConfig } from '../../configs/combatConfig'
import { mimicConfigs } from '../../configs/mimicConfigs'
import type { MimicId } from '../../types/game'
import type { EffectCardId } from '../game/effectCards/effectCardRules'
import type { SimulatedRound, StageKey } from './balanceSimulation'

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
    carrierRate: Record<EffectCardId, number>
    cardsGenerated: Record<EffectCardId, number>
    cardsTriggered: Record<EffectCardId, number>
    averageCardsGeneratedPerRound: Record<EffectCardId, number>
    averageCardsTriggeredPerRound: Record<EffectCardId, number>
    averageHitsPerTrigger: Record<EffectCardId, number>
    averageDamagePerTrigger: Record<EffectCardId, number>
    defeats: Record<EffectCardId, number>
    thunderStrikesTriggered: number
    meteoritesLaunched: number
    meteoriteImpacts: number
    maximumChainDepth: number
  }
  unfinishedRoundCount: number
  summary: string
}

export function createBalanceSimulationReport(
  rounds: readonly SimulatedRound[],
  stagePools: Record<StageKey, MimicId[]>,
): BalanceSimulationReport {
  const stageAverages = calculateStageAverages(rounds, stagePools)
  const targetRounds = rounds.filter(
    (round) =>
      round.playerModel === 'target' && round.accuracyModel === 'target',
  )
  const targetDefeatRounds = targetRounds.filter(
    (round) => round.jackpotCase === 'defeated',
  )
  const eligibleSpawns = sum(rounds.map((round) => round.effectCardEligibleSpawns))
  const chanceCardsGenerated = sumEffectMetric(
    rounds,
    (round) => round.chanceEffectCardsGenerated,
  )
  const cardsGenerated = sumEffectMetric(rounds, (round) => round.effectCardsGenerated)
  const cardsTriggered = sumEffectMetric(rounds, (round) => round.cardsTriggered)
  const attackHits = sumEffectMetric(rounds, (round) => round.attackHits)
  const additionalDamage = sumEffectMetric(rounds, (round) => round.additionalDamage)
  const report: BalanceSimulationReport = {
    configVersion: balanceSimulationConfig.configVersion,
    caseCount: rounds.length,
    maximumPlacementRejectionRatio: Math.max(
      ...rounds.map((round) => round.placementRejections / round.placementAttempts),
    ),
    maximumSpawnShareDeviation: calculateMaximumSpawnShareDeviation(
      rounds,
      stagePools,
    ),
    targetProfileAverageDefeatedMimics: average(
      targetRounds.map((round) => sum(Object.values(round.defeatedByMimic))),
    ),
    targetProfileJackpotDefeatRate: average(
      targetDefeatRounds.map((round) => Number(round.jackpotDefeated)),
    ),
    ...stageAverages,
    mimicDefeatTimeMs: calculateMimicDefeatTimes(),
    jackpotMetrics: {
      averageOpportunities: average(rounds.map((round) => round.jackpotOpportunities)),
      revealRate: average(rounds.map((round) => Number(round.jackpotRevealed))),
      defeatRate: average(rounds.map((round) => Number(round.jackpotDefeated))),
      escapeRate: average(rounds.map((round) => Number(round.jackpotEscaped))),
    },
    effectCardMetrics: {
      carrierRate: {
        thunder: chanceCardsGenerated.thunder / eligibleSpawns,
        meteorite: chanceCardsGenerated.meteorite / eligibleSpawns,
      },
      cardsGenerated,
      cardsTriggered,
      averageCardsGeneratedPerRound: divideByRoundCount(
        cardsGenerated,
        rounds.length,
      ),
      averageCardsTriggeredPerRound: divideByRoundCount(
        cardsTriggered,
        rounds.length,
      ),
      averageHitsPerTrigger: divideEffectMetrics(attackHits, cardsTriggered),
      averageDamagePerTrigger: divideEffectMetrics(
        additionalDamage,
        cardsTriggered,
      ),
      defeats: sumEffectMetric(rounds, (round) => round.effectDefeats),
      thunderStrikesTriggered: sum(
        rounds.map((round) => round.thunderStrikesTriggered),
      ),
      meteoritesLaunched: sum(rounds.map((round) => round.meteoritesLaunched)),
      meteoriteImpacts: sum(rounds.map((round) => round.meteoriteImpacts)),
      maximumChainDepth: Math.max(
        ...rounds.map((round) => round.maximumEffectChainDepth),
      ),
    },
    unfinishedRoundCount: rounds.filter((round) => !round.finished).length,
    summary: '',
  }
  report.summary = createSummary(report)
  return report
}

function calculateStageAverages(
  rounds: readonly SimulatedRound[],
  stagePools: Record<StageKey, MimicId[]>,
): Pick<
  BalanceSimulationReport,
  | 'stageAverageTotalIncome'
  | 'stageAverageGeneratedMimics'
  | 'stageAverageDefeatedMimics'
> {
  const stageAverageTotalIncome = {} as Record<StageKey, number>
  const stageAverageGeneratedMimics = {} as Record<StageKey, number>
  const stageAverageDefeatedMimics = {} as Record<StageKey, number>
  for (const stage of Object.keys(stagePools) as StageKey[]) {
    const stageRounds = rounds.filter((round) => round.stage === stage)
    stageAverageTotalIncome[stage] = average(
      stageRounds.map((round) => round.ordinaryIncome + round.jackpotIncome),
    )
    stageAverageGeneratedMimics[stage] = average(
      stageRounds.map((round) => sum(Object.values(round.generatedByMimic))),
    )
    stageAverageDefeatedMimics[stage] = average(
      stageRounds.map((round) => sum(Object.values(round.defeatedByMimic))),
    )
  }
  return {
    stageAverageTotalIncome,
    stageAverageGeneratedMimics,
    stageAverageDefeatedMimics,
  }
}

function calculateMaximumSpawnShareDeviation(
  rounds: readonly SimulatedRound[],
  stagePools: Record<StageKey, MimicId[]>,
): number {
  let maximumDeviation = 0
  for (const stage of Object.keys(stagePools) as StageKey[]) {
    const pool = stagePools[stage]
    const stageRounds = rounds.filter((round) => round.stage === stage)
    const generatedTotal = sum(
      stageRounds.map((round) => sum(Object.values(round.generatedByMimic))),
    )
    const weightTotal = sum(pool.map((id) => mimicConfigs[id].spawnWeight))
    for (const mimicId of pool) {
      const generated = sum(
        stageRounds.map((round) => round.generatedByMimic[mimicId]),
      )
      const actual = generated / generatedTotal
      const expected = mimicConfigs[mimicId].spawnWeight / weightTotal
      maximumDeviation = Math.max(maximumDeviation, Math.abs(actual - expected))
    }
  }
  return maximumDeviation
}

function calculateMimicDefeatTimes(): BalanceSimulationReport['mimicDefeatTimeMs'] {
  const result = {} as BalanceSimulationReport['mimicDefeatTimeMs']
  for (const mimicId of Object.keys(mimicConfigs) as MimicId[]) {
    const times: number[] = []
    for (const clickRate of Object.values(
      balanceSimulationConfig.playerClickRatesPerSecond,
    )) {
      for (const accuracy of Object.values(balanceSimulationConfig.accuracyRates)) {
        const hits = Math.ceil(
          mimicConfigs[mimicId].maximumHealth / combatConfig.initialWeaponDamage,
        )
        times.push((hits / (clickRate * accuracy)) * 1_000)
      }
    }
    result[mimicId] = { average: average(times), p90: percentile(times, 0.9) }
  }
  return result
}

function sumEffectMetric(
  rounds: readonly SimulatedRound[],
  select: (round: SimulatedRound) => Record<EffectCardId, number>,
): Record<EffectCardId, number> {
  return rounds.reduce(
    (totals, round) => {
      const metric = select(round)
      totals.thunder += metric.thunder
      totals.meteorite += metric.meteorite
      return totals
    },
    { thunder: 0, meteorite: 0 },
  )
}

function divideEffectMetrics(
  numerator: Record<EffectCardId, number>,
  denominator: Record<EffectCardId, number>,
): Record<EffectCardId, number> {
  return {
    thunder: numerator.thunder / Math.max(1, denominator.thunder),
    meteorite: numerator.meteorite / Math.max(1, denominator.meteorite),
  }
}

function divideByRoundCount(
  metric: Record<EffectCardId, number>,
  roundCount: number,
): Record<EffectCardId, number> {
  return {
    thunder: metric.thunder / roundCount,
    meteorite: metric.meteorite / roundCount,
  }
}

function createSummary(report: BalanceSimulationReport): string {
  const metrics = report.effectCardMetrics
  return [
    `Balance ${report.configVersion}: ${report.caseCount} deterministic cases`,
    `placement rejection max ${(report.maximumPlacementRejectionRatio * 100).toFixed(1)}%`,
    `spawn share deviation max ${(report.maximumSpawnShareDeviation * 100).toFixed(1)}%`,
    `target defeats ${report.targetProfileAverageDefeatedMimics.toFixed(1)} mimics/round`,
    `target Jackpot defeat ${(report.targetProfileJackpotDefeatRate * 100).toFixed(1)}%`,
    `Thunder ${(metrics.carrierRate.thunder * 100).toFixed(1)}% carriers / ${metrics.averageCardsGeneratedPerRound.thunder.toFixed(2)} attached / ${metrics.averageCardsTriggeredPerRound.thunder.toFixed(2)} triggered / ${metrics.averageHitsPerTrigger.thunder.toFixed(2)} hits / ${metrics.averageDamagePerTrigger.thunder.toFixed(1)} damage / ${metrics.defeats.thunder} defeats`,
    `Meteorite ${(metrics.carrierRate.meteorite * 100).toFixed(1)}% carriers / ${metrics.averageCardsGeneratedPerRound.meteorite.toFixed(2)} attached / ${metrics.averageCardsTriggeredPerRound.meteorite.toFixed(2)} triggered / ${metrics.averageHitsPerTrigger.meteorite.toFixed(2)} hits / ${metrics.averageDamagePerTrigger.meteorite.toFixed(1)} damage / ${metrics.defeats.meteorite} defeats / ${metrics.meteoritesLaunched} launched / ${metrics.meteoriteImpacts} impacts`,
    `effect chain ${metrics.maximumChainDepth}`,
    `income ${Object.values(report.stageAverageTotalIncome).map((value) => value.toFixed(1)).join(' → ')}`,
  ].join(' | ')
}

function average(values: number[]): number {
  return sum(values) / values.length
}

function percentile(values: number[], ratio: number): number {
  const sorted = [...values].sort((first, second) => first - second)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))]
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}
