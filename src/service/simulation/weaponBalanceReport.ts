import { balanceSimulationConfig } from '../../configs/balanceSimulationConfig'
import { mimicConfigs } from '../../configs/mimicConfigs'
import {
  weaponConfig,
  type WeaponDefinition,
  type WeaponId,
} from '../../configs/weaponConfig'
import type { MimicId } from '../../types/game'
import type { SimulatedRound, StageKey } from './balanceSimulation'

export interface WeaponStageMetrics {
  averageDefeatedMimics: number
  averageGeneratedByMimic: Record<MimicId, number>
  averageDefeatedByMimic: Record<MimicId, number>
  generatedShareByMimic: Record<MimicId, number>
  averageCombatIncome: number
  averageEquipmentSaleIncome: number
  averageTotalIncome: number
  combatIncomeIncreaseFromPreviousWeapon: number | null
}

export interface WeaponMilestoneEconomyMetrics {
  mimicId: MimicId
  oldWeaponId: WeaponId
  newWeaponId: WeaponId
  incomeStage: 'normalRare1' | 'allMimics'
  oldWeaponHitCount: number
  newWeaponHitCount: number
  latestTargetRewardMultiplier: number
  oldWeaponLatestTargetRewardPerHit: number
  oldWeaponMasteredTargetRewardPerHit: number
}

export interface WeaponBalanceMetrics {
  byWeapon: Record<WeaponId, Record<StageKey, WeaponStageMetrics>>
  defeatTimeMsByWeapon: Record<
    WeaponId,
    Record<MimicId, { requiredHits: number; average: number; p90: number }>
  >
  milestoneEconomy: WeaponMilestoneEconomyMetrics[]
}

export function createWeaponBalanceMetrics(
  rounds: readonly SimulatedRound[],
  stages: readonly StageKey[],
): WeaponBalanceMetrics {
  const byWeapon = {} as WeaponBalanceMetrics['byWeapon']
  for (let weaponIndex = 0; weaponIndex < weaponConfig.definitions.length; weaponIndex += 1) {
    const weapon = weaponConfig.definitions[weaponIndex]
    const previousWeapon = weaponConfig.definitions[weaponIndex - 1]
    byWeapon[weapon.id] = {} as Record<StageKey, WeaponStageMetrics>
    for (const stage of stages) {
      const stageRounds = selectComparableRounds(rounds, weapon.id, stage)
      const averageGeneratedByMimic = averageMimicCounts(
        stageRounds,
        (round) => round.generatedByMimic,
      )
      const averageDefeatedByMimic = averageMimicCounts(
        stageRounds,
        (round) => round.defeatedByMimic,
      )
      const generatedTotal = sum(Object.values(averageGeneratedByMimic))
      const combatIncome = average(
        stageRounds.map((round) => round.ordinaryIncome + round.jackpotIncome),
      )
      const saleIncome = average(
        stageRounds.map((round) => round.equipmentSaleIncome),
      )
      const previousCombatIncome = previousWeapon
        ? average(
            selectComparableRounds(rounds, previousWeapon.id, stage).map(
              (round) => round.ordinaryIncome + round.jackpotIncome,
            ),
          )
        : null
      byWeapon[weapon.id][stage] = {
        averageDefeatedMimics: average(
          stageRounds.map((round) => sum(Object.values(round.defeatedByMimic))),
        ),
        averageGeneratedByMimic,
        averageDefeatedByMimic,
        generatedShareByMimic: mapMimicCounts(
          (mimicId) =>
            averageGeneratedByMimic[mimicId] / Math.max(1, generatedTotal),
        ),
        averageCombatIncome: combatIncome,
        averageEquipmentSaleIncome: saleIncome,
        averageTotalIncome: combatIncome + saleIncome,
        combatIncomeIncreaseFromPreviousWeapon:
          previousCombatIncome === null
            ? null
            : combatIncome / previousCombatIncome - 1,
      }
    }
  }
  return {
    byWeapon,
    defeatTimeMsByWeapon: createDefeatTimeMetrics(),
    milestoneEconomy: createMilestoneEconomyMetrics(),
  }
}

function createDefeatTimeMetrics(): WeaponBalanceMetrics['defeatTimeMsByWeapon'] {
  return Object.fromEntries(
    weaponConfig.definitions.map((weapon) => [
      weapon.id,
      Object.fromEntries(
        (Object.keys(mimicConfigs) as MimicId[]).map((mimicId) => {
          const requiredHits = hitCount(mimicId, weapon)
          const times = Object.values(
            balanceSimulationConfig.playerClickRatesPerSecond,
          ).flatMap((clickRate) =>
            Object.values(balanceSimulationConfig.accuracyRates).map(
              (accuracy) => (requiredHits / (clickRate * accuracy)) * 1_000,
            ),
          )
          return [
            mimicId,
            {
              requiredHits,
              average: average(times),
              p90: percentile(times, 0.9),
            },
          ]
        }),
      ),
    ]),
  ) as WeaponBalanceMetrics['defeatTimeMsByWeapon']
}

function averageMimicCounts(
  rounds: readonly SimulatedRound[],
  select: (round: SimulatedRound) => Record<MimicId, number>,
): Record<MimicId, number> {
  return mapMimicCounts((mimicId) =>
    average(rounds.map((round) => select(round)[mimicId])),
  )
}

function mapMimicCounts(
  map: (mimicId: MimicId) => number,
): Record<MimicId, number> {
  return Object.fromEntries(
    (Object.keys(mimicConfigs) as MimicId[]).map((mimicId) => [
      mimicId,
      map(mimicId),
    ]),
  ) as Record<MimicId, number>
}

export function summarizeWeaponBalanceMetrics(
  metrics: WeaponBalanceMetrics,
): string {
  return `weapon ${weaponConfig.definitions.map((weapon) => {
    const stages = Object.values(metrics.byWeapon[weapon.id])
    const allMimics = metrics.byWeapon[weapon.id].allMimics
    return `${weapon.displayName} income ${stages.map((stage) => stage.averageCombatIncome.toFixed(1)).join('/')} defeats ${stages.map((stage) => stage.averageDefeatedMimics.toFixed(1)).join('/')} all-pool gen/def ${formatMimicPairs(allMimics.averageGeneratedByMimic, allMimics.averageDefeatedByMimic)}`
  }).join(' → ')}`
}

function formatMimicPairs(
  generated: Record<MimicId, number>,
  defeated: Record<MimicId, number>,
): string {
  return (Object.keys(mimicConfigs) as MimicId[])
    .map((id) => `${id}:${generated[id].toFixed(1)}/${defeated[id].toFixed(1)}`)
    .join(',')
}

function selectComparableRounds(
  rounds: readonly SimulatedRound[],
  weaponId: WeaponId,
  stage: StageKey,
): SimulatedRound[] {
  return rounds.filter(
    (round) =>
      round.weaponId === weaponId &&
      round.stage === stage &&
      round.equipmentLoadout === 'none' &&
      round.backpackManagementPolicy === 'noSwitching',
  )
}

function createMilestoneEconomyMetrics(): WeaponMilestoneEconomyMetrics[] {
  return balanceSimulationConfig.targets.weapons.hitCountMilestones.map(
    (milestone, index) => {
      const previousMimicId = index === 0 ? 'normal' : 'rare1'
      const oldWeapon = requireWeapon(milestone.oldWeaponId)
      const oldWeaponHitCount = hitCount(milestone.mimicId, oldWeapon)
      const masteredTargetHitCount = hitCount(previousMimicId, oldWeapon)
      return {
        ...milestone,
        oldWeaponHitCount,
        newWeaponHitCount: hitCount(
          milestone.mimicId,
          requireWeapon(milestone.newWeaponId),
        ),
        latestTargetRewardMultiplier:
          mimicConfigs[milestone.mimicId].baseReward /
          mimicConfigs[previousMimicId].baseReward,
        oldWeaponLatestTargetRewardPerHit:
          mimicConfigs[milestone.mimicId].baseReward / oldWeaponHitCount,
        oldWeaponMasteredTargetRewardPerHit:
          mimicConfigs[previousMimicId].baseReward / masteredTargetHitCount,
      }
    },
  )
}

function requireWeapon(weaponId: WeaponId): WeaponDefinition {
  const definition = weaponConfig.definitions.find(({ id }) => id === weaponId)
  if (!definition) throw new Error(`Unknown configured weapon: ${weaponId}`)
  return definition
}

function hitCount(mimicId: MimicId, weapon: WeaponDefinition): number {
  return Math.ceil(mimicConfigs[mimicId].maximumHealth / weapon.baseDamage)
}

function average(values: readonly number[]): number {
  return sum(values) / Math.max(1, values.length)
}

function percentile(values: readonly number[], ratio: number): number {
  const sorted = [...values].sort((first, second) => first - second)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))]
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}
