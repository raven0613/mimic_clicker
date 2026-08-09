import { balanceSimulationConfig } from '../../configs/balanceSimulationConfig'
import { combatConfig } from '../../configs/combatConfig'
import type { EquipmentId } from '../../configs/equipmentConfig'
import { mimicConfigs } from '../../configs/mimicConfigs'
import type { MimicId } from '../../types/game'
import type { EffectCardId } from '../game/attachedCards/attachedCardRules'
import type {
  EquipmentLoadoutKey,
  SimulatedRound,
  StageKey,
} from './balanceSimulation'
import type { EquipmentCounts } from './equipmentBalanceSimulation'
import {
  createClearRefillBalanceMetrics,
  type ClearRefillBalanceMetrics,
} from './clearRefillBalanceReport'

export interface BalanceSimulationReport {
  configVersion: string
  caseCount: number
  maximumPlacementRejectionRatio: number
  maximumSpawnShareDeviation: number
  targetProfileAverageDefeatedMimics: number
  targetProfileJackpotDefeatRate: number
  stageAverageCombatIncome: Record<StageKey, number>
  stageAverageEquipmentSaleIncome: Record<StageKey, number>
  stageAverageTotalIncome: Record<StageKey, number>
  stageEquipmentSaleIncomeShare: Record<StageKey, number>
  stageAverageInitialFieldMimics: Record<StageKey, number>
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
    tornadoesSpawned: number
    maximumChainDepth: number
  }
  clearRefillMetrics: ClearRefillBalanceMetrics
  equipmentMetrics: {
    averageVisibleGeneratedPerRound: EquipmentCounts
    averageHiddenGeneratedPerRound: EquipmentCounts
    averageSuccessfulDropsPerRound: EquipmentCounts
    averageEquippedPerRound: EquipmentCounts
    averageBackpackPerRound: EquipmentCounts
    averageActivationTimeMs: number
    averageAdditionalDamageByLoadout: Record<
      EquipmentLoadoutKey,
      { sword: number; ring: number }
    >
    averageRingDamageStrikesByLoadout: Record<EquipmentLoadoutKey, number>
    averageDefeatedMimicsByLoadout: Record<EquipmentLoadoutKey, number>
    averageOrdinaryIncomeByLoadout: Record<EquipmentLoadoutKey, number>
    jackpotDefeatRateByLoadout: Record<EquipmentLoadoutKey, number>
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
      round.playerModel === 'target' &&
      round.accuracyModel === 'target' &&
      round.equipmentLoadout === 'none',
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
        tornado: chanceCardsGenerated.tornado / eligibleSpawns,
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
      tornadoesSpawned: sum(rounds.map((round) => round.tornadoesSpawned)),
      maximumChainDepth: Math.max(
        ...rounds.map((round) => round.maximumEffectChainDepth),
      ),
    },
    clearRefillMetrics: createClearRefillBalanceMetrics(rounds),
    equipmentMetrics: createEquipmentMetrics(rounds),
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
  | 'stageAverageCombatIncome'
  | 'stageAverageEquipmentSaleIncome'
  | 'stageEquipmentSaleIncomeShare'
  | 'stageAverageInitialFieldMimics'
  | 'stageAverageGeneratedMimics'
  | 'stageAverageDefeatedMimics'
> {
  const stageAverageCombatIncome = {} as Record<StageKey, number>
  const stageAverageEquipmentSaleIncome = {} as Record<StageKey, number>
  const stageAverageTotalIncome = {} as Record<StageKey, number>
  const stageEquipmentSaleIncomeShare = {} as Record<StageKey, number>
  const stageAverageInitialFieldMimics = {} as Record<StageKey, number>
  const stageAverageGeneratedMimics = {} as Record<StageKey, number>
  const stageAverageDefeatedMimics = {} as Record<StageKey, number>
  for (const stage of Object.keys(stagePools) as StageKey[]) {
    const stageRounds = rounds.filter(
      (round) =>
        round.stage === stage && round.equipmentLoadout === 'none',
    )
    stageAverageCombatIncome[stage] = average(
      stageRounds.map((round) => round.ordinaryIncome + round.jackpotIncome),
    )
    stageAverageEquipmentSaleIncome[stage] = average(
      stageRounds.map((round) => round.equipmentSaleIncome),
    )
    stageAverageTotalIncome[stage] =
      stageAverageCombatIncome[stage] + stageAverageEquipmentSaleIncome[stage]
    stageEquipmentSaleIncomeShare[stage] =
      stageAverageEquipmentSaleIncome[stage] / stageAverageTotalIncome[stage]
    stageAverageInitialFieldMimics[stage] = average(
      stageRounds.map((round) => round.initialFieldMimicCount),
    )
    stageAverageGeneratedMimics[stage] = average(
      stageRounds.map((round) => sum(Object.values(round.generatedByMimic))),
    )
    stageAverageDefeatedMimics[stage] = average(
      stageRounds.map((round) => sum(Object.values(round.defeatedByMimic))),
    )
  }
  return {
    stageAverageCombatIncome,
    stageAverageEquipmentSaleIncome,
    stageAverageTotalIncome,
    stageEquipmentSaleIncomeShare,
    stageAverageInitialFieldMimics,
    stageAverageGeneratedMimics,
    stageAverageDefeatedMimics,
  }
}

function createEquipmentMetrics(
  rounds: readonly SimulatedRound[],
): BalanceSimulationReport['equipmentMetrics'] {
  const activationCount = sum(
    rounds.map((round) => round.equipment.activationCount),
  )
  const averageAdditionalDamageByLoadout = {} as Record<
    EquipmentLoadoutKey,
    { sword: number; ring: number }
  >
  const averageRingDamageStrikesByLoadout = {} as Record<
    EquipmentLoadoutKey,
    number
  >
  const averageDefeatedMimicsByLoadout = {} as Record<
    EquipmentLoadoutKey,
    number
  >
  const averageOrdinaryIncomeByLoadout = {} as Record<
    EquipmentLoadoutKey,
    number
  >
  const jackpotDefeatRateByLoadout = {} as Record<
    EquipmentLoadoutKey,
    number
  >
  for (const loadout of Object.keys(
    balanceSimulationConfig.equipmentLoadouts,
  ) as EquipmentLoadoutKey[]) {
    const loadoutRounds = rounds.filter(
      (round) => round.equipmentLoadout === loadout,
    )
    averageAdditionalDamageByLoadout[loadout] = {
      sword: average(loadoutRounds.map((round) => round.swordAdditionalDamage)),
      ring: average(loadoutRounds.map((round) => round.ringAdditionalDamage)),
    }
    averageRingDamageStrikesByLoadout[loadout] = average(
      loadoutRounds.map((round) => round.ringDamageStrikes),
    )
    averageDefeatedMimicsByLoadout[loadout] = average(
      loadoutRounds.map((round) => round.equipment.defeatedMimics),
    )
    averageOrdinaryIncomeByLoadout[loadout] = average(
      loadoutRounds.map((round) => round.equipment.ordinaryIncome),
    )
    jackpotDefeatRateByLoadout[loadout] = average(
      loadoutRounds.map((round) => Number(round.equipment.jackpotDefeated)),
    )
  }
  return {
    averageVisibleGeneratedPerRound: averageEquipmentCounts(
      rounds,
      (round) => round.equipment.visibleGenerated,
    ),
    averageHiddenGeneratedPerRound: averageEquipmentCounts(
      rounds,
      (round) => round.equipment.hiddenGenerated,
    ),
    averageSuccessfulDropsPerRound: averageEquipmentCounts(
      rounds,
      (round) => round.equipment.successfulDrops,
    ),
    averageEquippedPerRound: averageEquipmentCounts(
      rounds,
      (round) => round.equipment.equipped,
    ),
    averageBackpackPerRound: averageEquipmentCounts(
      rounds,
      (round) => round.equipment.backpack,
    ),
    averageActivationTimeMs:
      sum(rounds.map((round) => round.equipment.activationTimeTotalMs)) /
      Math.max(1, activationCount),
    averageAdditionalDamageByLoadout,
    averageRingDamageStrikesByLoadout,
    averageDefeatedMimicsByLoadout,
    averageOrdinaryIncomeByLoadout,
    jackpotDefeatRateByLoadout,
  }
}

function averageEquipmentCounts(
  rounds: readonly SimulatedRound[],
  select: (round: SimulatedRound) => EquipmentCounts,
): EquipmentCounts {
  return (['sword', 'ring'] as const).reduce(
    (counts, id) => {
      counts[id] = average(rounds.map((round) => select(round)[id]))
      return counts
    },
    { sword: 0, ring: 0 } as Record<EquipmentId, number>,
  )
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
      totals.tornado += metric.tornado
      return totals
    },
    { thunder: 0, meteorite: 0, tornado: 0 },
  )
}

function divideEffectMetrics(
  numerator: Record<EffectCardId, number>,
  denominator: Record<EffectCardId, number>,
): Record<EffectCardId, number> {
  return {
    thunder: numerator.thunder / Math.max(1, denominator.thunder),
    meteorite: numerator.meteorite / Math.max(1, denominator.meteorite),
    tornado: numerator.tornado / Math.max(1, denominator.tornado),
  }
}

function divideByRoundCount(
  metric: Record<EffectCardId, number>,
  roundCount: number,
): Record<EffectCardId, number> {
  return {
    thunder: metric.thunder / roundCount,
    meteorite: metric.meteorite / roundCount,
    tornado: metric.tornado / roundCount,
  }
}

function createSummary(report: BalanceSimulationReport): string {
  const metrics = report.effectCardMetrics
  const equipment = report.equipmentMetrics
  const clearRefill = report.clearRefillMetrics
  return [
    `Balance ${report.configVersion}: ${report.caseCount} deterministic cases`,
    `placement rejection max ${(report.maximumPlacementRejectionRatio * 100).toFixed(1)}%`,
    `initial field ${Object.values(report.stageAverageInitialFieldMimics).map((value) => value.toFixed(1)).join(' → ')} mimics`,
    `spawn share deviation max ${(report.maximumSpawnShareDeviation * 100).toFixed(1)}%`,
    `baseline target defeats ${report.targetProfileAverageDefeatedMimics.toFixed(1)} mimics/round`,
    `baseline target Jackpot defeat ${(report.targetProfileJackpotDefeatRate * 100).toFixed(1)}%`,
    `Thunder ${(metrics.carrierRate.thunder * 100).toFixed(1)}% carriers / ${metrics.averageCardsGeneratedPerRound.thunder.toFixed(2)} attached / ${metrics.averageCardsTriggeredPerRound.thunder.toFixed(2)} triggered / ${metrics.averageHitsPerTrigger.thunder.toFixed(2)} hits / ${metrics.averageDamagePerTrigger.thunder.toFixed(1)} damage / ${metrics.defeats.thunder} defeats`,
    `Meteorite ${(metrics.carrierRate.meteorite * 100).toFixed(1)}% carriers / ${metrics.averageCardsGeneratedPerRound.meteorite.toFixed(2)} attached / ${metrics.averageCardsTriggeredPerRound.meteorite.toFixed(2)} triggered / ${metrics.averageHitsPerTrigger.meteorite.toFixed(2)} hits / ${metrics.averageDamagePerTrigger.meteorite.toFixed(1)} damage / ${metrics.defeats.meteorite} defeats / ${metrics.meteoritesLaunched} launched / ${metrics.meteoriteImpacts} impacts`,
    `Tornado ${(metrics.carrierRate.tornado * 100).toFixed(1)}% carriers / ${metrics.averageCardsGeneratedPerRound.tornado.toFixed(2)} attached / ${metrics.averageCardsTriggeredPerRound.tornado.toFixed(2)} triggered / ${metrics.averageHitsPerTrigger.tornado.toFixed(2)} hits / ${metrics.averageDamagePerTrigger.tornado.toFixed(1)} damage / ${metrics.defeats.tornado} defeats / ${metrics.tornadoesSpawned} spawned`,
    `effect chain ${metrics.maximumChainDepth}`,
    `clear ${clearRefill.averageFullClearsPerRound.toFixed(2)} / refill ${clearRefill.averageRefillsPerRound.toFixed(2)} per round / empty p90 ${clearRefill.p90EmptyFieldDurationMs.toFixed(0)}ms / refill total income +${(clearRefill.refillTotalIncomeIncreaseRatio * 100).toFixed(1)}%`,
    `clear profiles ${clearRefill.profileAverageFullClears.weak.toFixed(2)} → ${clearRefill.profileAverageFullClears.standard.toFixed(2)} → ${clearRefill.profileAverageFullClears.strong.toFixed(2)}`,
    `equipment drops sword ${equipment.averageSuccessfulDropsPerRound.sword.toFixed(2)} / ring ${equipment.averageSuccessfulDropsPerRound.ring.toFixed(2)} per round`,
    `equipment slot activation ${equipment.averageActivationTimeMs.toFixed(0)}ms`,
    `loadout damage sword×2 ${equipment.averageAdditionalDamageByLoadout.duplicateSword.sword.toFixed(1)} / ring×2 ${equipment.averageAdditionalDamageByLoadout.duplicateRing.ring.toFixed(1)}`,
    `combat income ${Object.values(report.stageAverageCombatIncome).map((value) => value.toFixed(1)).join(' → ')}`,
    `equipment sale ${Object.values(report.stageAverageEquipmentSaleIncome).map((value) => value.toFixed(1)).join(' → ')}`,
    `sale share ${Object.values(report.stageEquipmentSaleIncomeShare).map((value) => `${(value * 100).toFixed(1)}%`).join(' → ')}`,
    `total income ${Object.values(report.stageAverageTotalIncome).map((value) => value.toFixed(1)).join(' → ')}`,
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
