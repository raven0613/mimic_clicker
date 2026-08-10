import { balanceSimulationConfig } from '../../configs/balanceSimulationConfig'
import type { SimulatedRound } from './balanceSimulation'
import type { BackpackManagementPolicyKey } from './equipmentManagementPolicy'

export interface EquipmentManagementBalanceMetrics {
  averageSwitchesByPolicy: Record<BackpackManagementPolicyKey, number>
  averageDefeatedMimicsByPolicy: Record<BackpackManagementPolicyKey, number>
  averageTotalIncomeByPolicy: Record<BackpackManagementPolicyKey, number>
  jackpotDefeatRateByPolicy: Record<BackpackManagementPolicyKey, number>
}

export function createEquipmentManagementBalanceMetrics(
  rounds: readonly SimulatedRound[],
): EquipmentManagementBalanceMetrics {
  const comparableRounds = rounds.filter(
    (round) =>
      round.playerModel === 'target' && round.accuracyModel === 'target',
  )
  const averageSwitchesByPolicy = emptyPolicyRecord()
  const averageDefeatedMimicsByPolicy = emptyPolicyRecord()
  const averageTotalIncomeByPolicy = emptyPolicyRecord()
  const jackpotDefeatRateByPolicy = emptyPolicyRecord()

  for (const policy of Object.keys(
    balanceSimulationConfig.backpackManagementPolicies,
  ) as BackpackManagementPolicyKey[]) {
    const policyRounds = comparableRounds.filter(
      (round) => round.backpackManagementPolicy === policy,
    )
    averageSwitchesByPolicy[policy] = average(
      policyRounds.map((round) => round.equipment.switchCount),
    )
    averageDefeatedMimicsByPolicy[policy] = average(
      policyRounds.map((round) => round.equipment.defeatedMimics),
    )
    averageTotalIncomeByPolicy[policy] = average(
      policyRounds.map(
        (round) =>
          round.equipment.ordinaryIncome +
          (round.equipment.jackpotDefeated
            ? round.potentialJackpotReward
            : 0) +
          round.equipmentSaleIncome,
      ),
    )
    const intendedDefeatRounds = policyRounds.filter(
      (round) => round.jackpotCase === 'defeated',
    )
    jackpotDefeatRateByPolicy[policy] = average(
      intendedDefeatRounds.map((round) =>
        Number(round.equipment.jackpotDefeated),
      ),
    )
  }

  return {
    averageSwitchesByPolicy,
    averageDefeatedMimicsByPolicy,
    averageTotalIncomeByPolicy,
    jackpotDefeatRateByPolicy,
  }
}

function emptyPolicyRecord(): Record<BackpackManagementPolicyKey, number> {
  return {
    noSwitching: 0,
    swordPriority: 0,
    ringPriority: 0,
  }
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0
  return values.reduce((total, value) => total + value, 0) / values.length
}
