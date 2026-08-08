import { describe, expect, it } from 'vitest'

import { balanceSimulationConfig } from '../../configs/balanceSimulationConfig'
import { effectCardConfig } from '../../configs/effectCardConfig'
import { mimicConfigs } from '../../configs/mimicConfigs'
import { runBalanceSimulation } from './balanceSimulation'

describe('fixed-seed balance simulation', () => {
  it('is repeatable for the same config and seed matrix', () => {
    expect(runBalanceSimulation()).toEqual(runBalanceSimulation())
  })

  it('keeps the initial vertical-slice balance inside provisional targets', () => {
    const report = runBalanceSimulation()

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
    expect(
      Math.abs(
        report.effectCardMetrics.carrierRate.thunder -
          effectCardConfig.thunder.carrierSpawnChance,
      ),
    ).toBeLessThanOrEqual(
      balanceSimulationConfig.targets.effectCardCarrierRateTolerance,
    )
    expect(
      Math.abs(
        report.effectCardMetrics.carrierRate.meteorite -
          effectCardConfig.meteorite.carrierSpawnChance,
      ),
    ).toBeLessThanOrEqual(
      balanceSimulationConfig.targets.effectCardCarrierRateTolerance,
    )
    expect(report.effectCardMetrics.thunderStrikesTriggered).toBeGreaterThan(0)
    expect(report.effectCardMetrics.meteoritesLaunched).toBeGreaterThan(0)
    expect(report.effectCardMetrics.meteoriteImpacts).toBeGreaterThan(0)
    expect(report.effectCardMetrics.defeats.thunder).toBeGreaterThan(0)
    expect(report.effectCardMetrics.defeats.meteorite).toBeGreaterThan(0)
    expect(report.effectCardMetrics.maximumChainDepth).toBeGreaterThanOrEqual(1)
    expect(report.unfinishedRoundCount).toBe(0)

    console.info(report.summary)
  })
})
