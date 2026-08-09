import { balanceSimulationConfig } from '../../configs/balanceSimulationConfig'
import type { EquipmentId } from '../../configs/equipmentConfig'
import type { EffectCardId } from '../game/attachedCards/attachedCardRules'
import type {
  EquipmentLoadoutKey,
  SimulatedRound,
} from './balanceSimulation'

export interface ClearRefillBalanceMetrics {
  averageFullClearsPerRound: number
  p90FullClearsPerRound: number
  averageRefillsPerRound: number
  p90RefillsPerRound: number
  averageRefilledMimicsPerRound: number
  averageRefilledDefeatsPerRound: number
  effectChainFullClearRate: number
  maximumDefeatsInEffectChain: number
  maximumEffectChainClearRatio: number
  averageEmptyFieldDurationMs: number
  p90EmptyFieldDurationMs: number
  suppressedEmptyFieldCount: number
  repeatedRefillsWithoutInterventionCount: number
  refillTotalIncomeIncreaseRatio: number
  refillEffectCardsGenerated: Record<EffectCardId, number>
  refillEquipmentCardsGenerated: Record<EquipmentId, number>
  rare1SurvivorsAfterEffectResolution: number
  rare2SurvivorsAfterEffectResolution: number
  effectDefeatsAfterPriorWeaponDamage: number
  averageFullClearsByLoadout: Record<EquipmentLoadoutKey, number>
  profileAverageFullClears: {
    weak: number
    standard: number
    strong: number
  }
}

export function createClearRefillBalanceMetrics(
  rounds: readonly SimulatedRound[],
): ClearRefillBalanceMetrics {
  const emptyDurations = rounds.flatMap(
    (round) => round.emptyFieldDurationsMs,
  )
  const incomeComparisonRounds = rounds.filter(
    (round) => round.stage === 'allMimics',
  )
  const refillIncome = sum(
    incomeComparisonRounds.map((round) => round.refillOrdinaryIncome),
  )
  const originalTotalIncome = sum(
    incomeComparisonRounds.map(
      (round) =>
        round.ordinaryIncome -
        round.refillOrdinaryIncome +
        round.jackpotIncome,
    ),
  )
  return {
    averageFullClearsPerRound: average(
      rounds.map((round) => round.fullClearCount),
    ),
    p90FullClearsPerRound: percentile(
      rounds.map((round) => round.fullClearCount),
      0.9,
    ),
    averageRefillsPerRound: average(
      rounds.map((round) => round.refillCount),
    ),
    p90RefillsPerRound: percentile(
      rounds.map((round) => round.refillCount),
      0.9,
    ),
    averageRefilledMimicsPerRound: average(
      rounds.map((round) => round.refilledMimicCount),
    ),
    averageRefilledDefeatsPerRound: average(
      rounds.map((round) => round.refilledDefeatCount),
    ),
    effectChainFullClearRate:
      sum(rounds.map((round) => round.effectChainFullClearCount)) /
      Math.max(1, sum(rounds.map((round) => round.effectChainCount))),
    maximumDefeatsInEffectChain: Math.max(
      ...rounds.map((round) => round.maximumDefeatsInEffectChain),
    ),
    maximumEffectChainClearRatio: Math.max(
      ...rounds.map((round) => round.maximumEffectChainClearRatio),
    ),
    averageEmptyFieldDurationMs:
      emptyDurations.length > 0 ? average(emptyDurations) : 0,
    p90EmptyFieldDurationMs:
      emptyDurations.length > 0 ? percentile(emptyDurations, 0.9) : 0,
    suppressedEmptyFieldCount: sum(
      rounds.map((round) => round.suppressedEmptyFieldCount),
    ),
    repeatedRefillsWithoutInterventionCount: sum(
      rounds.map(
        (round) => round.repeatedRefillsWithoutInterventionCount,
      ),
    ),
    refillTotalIncomeIncreaseRatio:
      refillIncome / Math.max(1, originalTotalIncome),
    refillEffectCardsGenerated: sumEffectCounts(
      rounds,
      (round) => round.refillEffectCardsGenerated,
    ),
    refillEquipmentCardsGenerated: {
      sword: sum(
        rounds.map(
          (round) => round.refillEquipmentCardsGenerated.sword,
        ),
      ),
      ring: sum(
        rounds.map(
          (round) => round.refillEquipmentCardsGenerated.ring,
        ),
      ),
    },
    rare1SurvivorsAfterEffectResolution: sum(
      rounds.map((round) => round.rare1SurvivorsAfterEffectResolution),
    ),
    rare2SurvivorsAfterEffectResolution: sum(
      rounds.map((round) => round.rare2SurvivorsAfterEffectResolution),
    ),
    effectDefeatsAfterPriorWeaponDamage: sum(
      rounds.map((round) => round.effectDefeatsAfterPriorWeaponDamage),
    ),
    averageFullClearsByLoadout: createLoadoutClearAverages(rounds),
    profileAverageFullClears: {
      weak: averageClearCountForProfile(rounds, 'slow', 'low', 'none'),
      standard: averageClearCountForProfile(
        rounds,
        'target',
        'target',
        'swordAndRing',
      ),
      strong: averageClearCountForProfile(
        rounds,
        'fast',
        'high',
        'duplicateSword',
      ),
    },
  }
}

function createLoadoutClearAverages(
  rounds: readonly SimulatedRound[],
): Record<EquipmentLoadoutKey, number> {
  const result = {} as Record<EquipmentLoadoutKey, number>
  for (const loadout of Object.keys(
    balanceSimulationConfig.equipmentLoadouts,
  ) as EquipmentLoadoutKey[]) {
    result[loadout] = average(
      rounds
        .filter((round) => round.equipmentLoadout === loadout)
        .map((round) => round.fullClearCount),
    )
  }
  return result
}

function averageClearCountForProfile(
  rounds: readonly SimulatedRound[],
  playerModel: SimulatedRound['playerModel'],
  accuracyModel: SimulatedRound['accuracyModel'],
  equipmentLoadout: EquipmentLoadoutKey,
): number {
  return average(
    rounds
      .filter(
        (round) =>
          round.stage === 'allMimics' &&
          round.playerModel === playerModel &&
          round.accuracyModel === accuracyModel &&
          round.equipmentLoadout === equipmentLoadout,
      )
      .map((round) => round.fullClearCount),
  )
}

function sumEffectCounts(
  rounds: readonly SimulatedRound[],
  select: (round: SimulatedRound) => Record<EffectCardId, number>,
): Record<EffectCardId, number> {
  return rounds.reduce(
    (counts, round) => {
      const current = select(round)
      counts.thunder += current.thunder
      counts.meteorite += current.meteorite
      counts.tornado += current.tornado
      return counts
    },
    { thunder: 0, meteorite: 0, tornado: 0 },
  )
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
