import { beforeAll, describe, expect, it } from 'vitest'

import { balanceSimulationConfig } from '../../configs/balanceSimulationConfig'
import { effectCardConfig } from '../../configs/effectCardConfig'
import { mimicConfigs } from '../../configs/mimicConfigs'
import { spawnConfig } from '../../configs/spawnConfig'
import {
  calculateInitialMeteoriteDamage,
} from '../game/effectCards/effectCardRules'
import { runBalanceSimulation, stagePools } from './balanceSimulation'

describe('fixed-seed balance simulation', () => {
  let firstReport: ReturnType<typeof runBalanceSimulation>
  let firstRepeatabilityReport: ReturnType<typeof runBalanceSimulation>
  let repeatedRepeatabilityReport: ReturnType<typeof runBalanceSimulation>

  beforeAll(() => {
    firstReport = runBalanceSimulation()
    const repeatabilitySeeds = [balanceSimulationConfig.seeds[0]]
    firstRepeatabilityReport = runBalanceSimulation({
      seeds: repeatabilitySeeds,
    })
    repeatedRepeatabilityReport = runBalanceSimulation({
      seeds: repeatabilitySeeds,
    })
  }, 70_000)

  it('is repeatable for the same config and seed matrix', () => {
    expect(firstRepeatabilityReport).toEqual(repeatedRepeatabilityReport)
  })

  it('keeps the initial vertical-slice balance inside provisional targets', () => {
    const report = firstReport
    console.info(report.summary)
    const baseCaseCount =
      Object.keys(stagePools).length *
      Object.keys(balanceSimulationConfig.playerClickRatesPerSecond).length *
      Object.keys(balanceSimulationConfig.accuracyRates).length *
      balanceSimulationConfig.jackpotCases.length *
      Object.keys(balanceSimulationConfig.equipmentLoadouts).length *
      balanceSimulationConfig.seeds.length
    const additionalManagementCaseCount =
      Object.keys(stagePools).length *
      balanceSimulationConfig.jackpotCases.length *
      Object.keys(balanceSimulationConfig.equipmentLoadouts).length *
      balanceSimulationConfig.seeds.length *
      (Object.keys(balanceSimulationConfig.backpackManagementPolicies).length -
        1)

    expect(report.caseCount).toBe(baseCaseCount + additionalManagementCaseCount)

    expect(mimicConfigs.rare1.maximumHealth).toBeGreaterThan(
      mimicConfigs.normal.maximumHealth,
    )
    expect(mimicConfigs.rare2.maximumHealth).toBeGreaterThan(
      mimicConfigs.rare1.maximumHealth,
    )
    expect(mimicConfigs.rare1.maximumHealth).toBeGreaterThan(
      calculateInitialMeteoriteDamage(),
    )
    expect(mimicConfigs.rare2.maximumHealth).toBeGreaterThan(
      calculateInitialMeteoriteDamage() *
        effectCardConfig.meteorite.initialMeteoriteCount,
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
    for (const initialFieldCount of Object.values(
      report.stageAverageInitialFieldMimics,
    )) {
      expect(initialFieldCount).toBeGreaterThan(0)
      expect(initialFieldCount).toBeLessThanOrEqual(
        spawnConfig.maximumConcurrentMimics,
      )
    }
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
    expect(report.stageAverageCombatIncome.normalRare1).toBeGreaterThan(
      report.stageAverageCombatIncome.normalOnly,
    )
    expect(report.stageAverageCombatIncome.allMimics).toBeGreaterThan(
      report.stageAverageCombatIncome.normalRare1,
    )
    for (const stage of Object.keys(
      report.stageAverageTotalIncome,
    ) as Array<keyof typeof report.stageAverageTotalIncome>) {
      expect(report.stageAverageTotalIncome[stage]).toBeCloseTo(
        report.stageAverageCombatIncome[stage] +
          report.stageAverageEquipmentSaleIncome[stage],
      )
      expect(report.stageEquipmentSaleIncomeShare[stage]).toBeGreaterThanOrEqual(
        balanceSimulationConfig.targets.equipmentSaleIncomeShare.minimum,
      )
      expect(report.stageEquipmentSaleIncomeShare[stage]).toBeLessThanOrEqual(
        balanceSimulationConfig.targets.equipmentSaleIncomeShare.maximum,
      )
    }
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
    expect(
      report.clearRefillMetrics.p90EmptyFieldDurationMs,
    ).toBeLessThanOrEqual(
      balanceSimulationConfig.targets.clearRefill
        .maximumP90EmptyFieldDurationMs,
    )
    expect(
      report.clearRefillMetrics.refillTotalIncomeIncreaseRatio,
    ).toBeLessThanOrEqual(
      balanceSimulationConfig.targets.clearRefill
        .maximumRefillTotalIncomeIncreaseRatio,
    )
    expect(
      report.clearRefillMetrics.averageRefillsPerRound,
    ).toBeGreaterThanOrEqual(
      balanceSimulationConfig.targets.clearRefill.averageRefillsPerRound
        .minimum,
    )
    expect(
      report.clearRefillMetrics.averageRefillsPerRound,
    ).toBeLessThanOrEqual(
      balanceSimulationConfig.targets.clearRefill.averageRefillsPerRound
        .maximum,
    )
    expect(
      report.clearRefillMetrics.averageEffectiveTargetsAfterRefill,
    ).toBeGreaterThanOrEqual(
      balanceSimulationConfig.targets.clearRefill
        .minimumAverageEffectiveTargetsAfterRefill,
    )
    expect(
      report.clearRefillMetrics.p90RefillTargetShortfall,
    ).toBeLessThanOrEqual(
      balanceSimulationConfig.targets.clearRefill
        .maximumP90RefillTargetShortfall,
    )
    expect(
      report.clearRefillMetrics.repeatedRefillsWithoutInterventionCount,
    ).toBeLessThanOrEqual(
      balanceSimulationConfig.targets.clearRefill
        .maximumRepeatedRefillsWithoutIntervention,
    )
    expect(report.clearRefillMetrics.jackpotChaseRefillCount).toBe(0)
    expect(report.clearRefillMetrics.maximumDefeatsInEffectChain).toBeGreaterThan(0)
    expect(report.clearRefillMetrics.maximumEffectChainClearRatio).toBeGreaterThan(0)
    expect(report.clearRefillMetrics.refillEffectCardsGenerated.thunder).toBeGreaterThan(0)
    expect(report.clearRefillMetrics.refillEffectCardsGenerated.meteorite).toBeGreaterThan(0)
    expect(report.clearRefillMetrics.refillEffectCardsGenerated.tornado).toBeGreaterThan(0)
    expect(report.clearRefillMetrics.refillEquipmentCardsGenerated.sword).toBeGreaterThan(0)
    expect(report.clearRefillMetrics.refillEquipmentCardsGenerated.ring).toBeGreaterThan(0)
    expect(report.clearRefillMetrics.rare1SurvivorsAfterEffectResolution).toBeGreaterThan(0)
    expect(report.clearRefillMetrics.rare2SurvivorsAfterEffectResolution).toBeGreaterThan(0)
    expect(report.clearRefillMetrics.effectDefeatsAfterPriorWeaponDamage).toBeGreaterThan(0)
    const clearProfiles = report.clearRefillMetrics.profileAverageFullClears
    expect(
      report.clearRefillMetrics.averageFullClearsPerRound,
    ).toBeGreaterThanOrEqual(
      balanceSimulationConfig.targets.clearRefill.averageFullClearsPerRound
        .minimum,
    )
    expect(
      report.clearRefillMetrics.averageFullClearsPerRound,
    ).toBeLessThanOrEqual(
      balanceSimulationConfig.targets.clearRefill.averageFullClearsPerRound
        .maximum,
    )
    expect(clearProfiles.weak).toBeGreaterThanOrEqual(
      balanceSimulationConfig.targets.clearRefill
        .weakAverageFullClearsPerRound.minimum,
    )
    expect(clearProfiles.weak).toBeLessThanOrEqual(
      balanceSimulationConfig.targets.clearRefill
        .weakAverageFullClearsPerRound.maximum,
    )
    expect(clearProfiles.standard).toBeGreaterThanOrEqual(
      balanceSimulationConfig.targets.clearRefill
        .standardAverageFullClearsPerRound.minimum,
    )
    expect(clearProfiles.standard).toBeLessThanOrEqual(
      balanceSimulationConfig.targets.clearRefill
        .standardAverageFullClearsPerRound.maximum,
    )
    expect(clearProfiles.strong).toBeGreaterThanOrEqual(
      balanceSimulationConfig.targets.clearRefill
        .strongAverageFullClearsPerRound.minimum,
    )
    expect(clearProfiles.strong).toBeLessThanOrEqual(
      balanceSimulationConfig.targets.clearRefill
        .strongAverageFullClearsPerRound.maximum,
    )
    expect(clearProfiles.standard).toBeGreaterThanOrEqual(clearProfiles.weak)
    expect(clearProfiles.strong).toBeGreaterThanOrEqual(clearProfiles.standard)
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
      report.equipmentMetrics.averageRingDamageStrikesByLoadout.none,
    ).toBeLessThan(
      report.equipmentMetrics.averageRingDamageStrikesByLoadout.singleRing,
    )
    expect(
      report.equipmentMetrics.averageDefeatedMimicsByLoadout.duplicateSword,
    ).toBeGreaterThanOrEqual(
      report.equipmentMetrics.averageDefeatedMimicsByLoadout.none,
    )
    expect(
      report.equipmentMetrics.jackpotDefeatRateByLoadout.duplicateRing,
    ).toBeGreaterThan(0)
    const management = report.equipmentMetrics.management
    expect(management.averageSwitchesByPolicy.noSwitching).toBe(0)
    expect(management.averageSwitchesByPolicy.swordPriority).toBeGreaterThan(0)
    expect(management.averageSwitchesByPolicy.ringPriority).toBeGreaterThan(0)
    for (const totalIncome of Object.values(
      management.averageTotalIncomeByPolicy,
    )) {
      expect(totalIncome).toBeGreaterThan(0)
    }
    for (const defeatRate of Object.values(
      management.jackpotDefeatRateByPolicy,
    )) {
      expect(defeatRate).toBeGreaterThanOrEqual(0)
      expect(defeatRate).toBeLessThanOrEqual(1)
    }
    expect(report.unfinishedRoundCount).toBe(0)

  })
})
