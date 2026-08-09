import { beforeAll, describe, expect, it } from 'vitest'

import { balanceSimulationConfig } from '../../configs/balanceSimulationConfig'
import { effectCardConfig } from '../../configs/effectCardConfig'
import { mimicConfigs } from '../../configs/mimicConfigs'
import { runBalanceSimulation } from './balanceSimulation'

describe('fixed-seed balance simulation', () => {
  let firstReport: ReturnType<typeof runBalanceSimulation>
  let repeatedReport: ReturnType<typeof runBalanceSimulation>

  beforeAll(() => {
    firstReport = runBalanceSimulation()
    repeatedReport = runBalanceSimulation()
  }, 70_000)

  it('is repeatable for the same config and seed matrix', () => {
    expect(firstReport).toEqual(repeatedReport)
  })

  it('keeps the initial vertical-slice balance inside provisional targets', () => {
    const report = firstReport

    expect(mimicConfigs.rare1.maximumHealth).toBeGreaterThan(
      mimicConfigs.normal.maximumHealth,
    )
    expect(mimicConfigs.rare2.maximumHealth).toBeGreaterThan(
      mimicConfigs.rare1.maximumHealth,
    )
    expect(mimicConfigs.rare1.baseReward).toBeGreaterThan(
      mimicConfigs.normal.baseReward,
    )
    expect(mimicConfigs.rare2.baseReward).toBeGreaterThan(
      mimicConfigs.rare1.baseReward,
    )
    expect(report.maximumPlacementRejectionRatio).toBeLessThanOrEqual(
      balanceSimulationConfig.targets.maximumPlacementRejectionRatio,
    )
    expect(report.maximumSpawnShareDeviation).toBeLessThanOrEqual(
      balanceSimulationConfig.targets.maximumSpawnShareDeviation,
    )
    expect(report.targetProfileAverageDefeatedMimics).toBeGreaterThanOrEqual(
      balanceSimulationConfig.targets.targetProfileDefeatedMimics.minimum,
    )
    expect(report.targetProfileAverageDefeatedMimics).toBeLessThanOrEqual(
      balanceSimulationConfig.targets.targetProfileDefeatedMimics.maximum,
    )
    expect(report.targetProfileJackpotDefeatRate).toBeGreaterThanOrEqual(
      balanceSimulationConfig.targets.targetProfileJackpotDefeatRate.minimum,
    )
    expect(report.targetProfileJackpotDefeatRate).toBeLessThanOrEqual(
      balanceSimulationConfig.targets.targetProfileJackpotDefeatRate.maximum,
    )
    expect(report.stageAverageTotalIncome.normalRare1).toBeGreaterThan(
      report.stageAverageTotalIncome.normalOnly,
    )
    expect(report.stageAverageTotalIncome.allMimics).toBeGreaterThan(
      report.stageAverageTotalIncome.normalRare1,
    )
    const carrierRates = Object.values(
      report.effectCardMetrics.carrierRate,
    )
    const configuredCandidateRates = [
      effectCardConfig.thunder.carrierSpawnChance,
      effectCardConfig.meteorite.carrierSpawnChance,
      effectCardConfig.tornado.carrierSpawnChance,
    ]
    expect(Math.min(...carrierRates)).toBeGreaterThan(0)
    expect(Math.max(...carrierRates)).toBeLessThanOrEqual(
      Math.max(...configuredCandidateRates) +
        balanceSimulationConfig.targets.effectCardCarrierRateTolerance,
    )
    expect(report.effectCardMetrics.thunderStrikesTriggered).toBeGreaterThan(0)
    expect(report.effectCardMetrics.meteoritesLaunched).toBeGreaterThan(0)
    expect(report.effectCardMetrics.meteoriteImpacts).toBeGreaterThan(0)
    expect(report.effectCardMetrics.tornadoesSpawned).toBeGreaterThan(0)
    expect(report.effectCardMetrics.defeats.thunder).toBeGreaterThan(0)
    expect(report.effectCardMetrics.defeats.meteorite).toBeGreaterThan(0)
    expect(report.effectCardMetrics.defeats.tornado).toBeGreaterThan(0)
    expect(report.effectCardMetrics.maximumChainDepth).toBeGreaterThanOrEqual(1)
    expect(report.equipmentMetrics.averageVisibleGeneratedPerRound.sword).toBeGreaterThan(0)
    expect(report.equipmentMetrics.averageVisibleGeneratedPerRound.ring).toBeGreaterThan(0)
    expect(report.equipmentMetrics.averageHiddenGeneratedPerRound.sword).toBeGreaterThan(0)
    expect(report.equipmentMetrics.averageHiddenGeneratedPerRound.ring).toBeGreaterThan(0)
    expect(report.equipmentMetrics.averageSuccessfulDropsPerRound.sword).toBeGreaterThan(0)
    expect(report.equipmentMetrics.averageSuccessfulDropsPerRound.ring).toBeGreaterThan(0)
    expect(
      report.equipmentMetrics.averageSuccessfulDropsPerRound.sword,
    ).toBeGreaterThanOrEqual(
      balanceSimulationConfig.targets.successfulEquipmentDropsPerRound.sword
        .minimum,
    )
    expect(
      report.equipmentMetrics.averageSuccessfulDropsPerRound.sword,
    ).toBeLessThanOrEqual(
      balanceSimulationConfig.targets.successfulEquipmentDropsPerRound.sword
        .maximum,
    )
    expect(
      report.equipmentMetrics.averageSuccessfulDropsPerRound.ring,
    ).toBeGreaterThanOrEqual(
      balanceSimulationConfig.targets.successfulEquipmentDropsPerRound.ring
        .minimum,
    )
    expect(
      report.equipmentMetrics.averageSuccessfulDropsPerRound.ring,
    ).toBeLessThanOrEqual(
      balanceSimulationConfig.targets.successfulEquipmentDropsPerRound.ring
        .maximum,
    )
    expect(
      report.equipmentMetrics.averageActivationTimeMs,
    ).toBeLessThanOrEqual(
      balanceSimulationConfig.targets.maximumAverageEquipmentActivationTimeMs,
    )
    expect(
      report.equipmentMetrics.averageAdditionalDamageByLoadout.duplicateSword
        .sword,
    ).toBeGreaterThan(
      report.equipmentMetrics.averageAdditionalDamageByLoadout.singleSword
        .sword,
    )
    expect(
      report.equipmentMetrics.averageAdditionalDamageByLoadout.duplicateRing
        .ring,
    ).toBeGreaterThan(
      report.equipmentMetrics.averageAdditionalDamageByLoadout.singleRing.ring,
    )
    expect(
      report.equipmentMetrics.averageRingStrikesByLoadout.none,
    ).toBeLessThan(
      report.equipmentMetrics.averageRingStrikesByLoadout.singleRing,
    )
    expect(
      report.equipmentMetrics.averageDefeatedMimicsByLoadout.duplicateSword,
    ).toBeGreaterThanOrEqual(
      report.equipmentMetrics.averageDefeatedMimicsByLoadout.none,
    )
    expect(
      report.equipmentMetrics.jackpotDefeatRateByLoadout.duplicateRing,
    ).toBeGreaterThan(0)
    expect(report.unfinishedRoundCount).toBe(0)

    console.info(report.summary)
  })
})
