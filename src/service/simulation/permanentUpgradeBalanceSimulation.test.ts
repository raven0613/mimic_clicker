import { beforeAll, describe, expect, it } from 'vitest'

import { balanceSimulationConfig } from '../../configs/balanceSimulationConfig'
import { weaponConfig } from '../../configs/weaponConfig'
import { runPermanentUpgradeBalanceSimulation } from './permanentUpgradeBalanceSimulation'

describe('permanent upgrade fixed-seed simulation', () => {
  let report: ReturnType<typeof runPermanentUpgradeBalanceSimulation>

  beforeAll(() => {
    report = runPermanentUpgradeBalanceSimulation()
  }, 120_000)

  it('covers every named permanent profile across the required matrix', () => {
    const matrixCasesPerProfile =
      Object.keys(balanceSimulationConfig.playerClickRatesPerSecond).length *
      Object.keys(balanceSimulationConfig.accuracyRates).length *
      balanceSimulationConfig.jackpotCases.length *
      balanceSimulationConfig.seeds.length *
      3 *
      weaponConfig.definitions.length

    expect(report.caseCount).toBe(
      matrixCasesPerProfile *
        Object.keys(balanceSimulationConfig.permanentUpgradeProfiles).length,
    )
    for (const metrics of Object.values(report.profiles)) {
      expect(metrics.caseCount).toBe(matrixCasesPerProfile)
    }
  })

  it('keeps each configured weapon damage fixed across permanent profiles', () => {
    for (const profile of Object.values(report.profiles)) {
      for (const weapon of weaponConfig.definitions) {
        expect(profile.baseWeaponDamageByWeapon[weapon.id]).toBe(
          weapon.baseDamage,
        )
      }
    }
  })

  it('keeps manual damage dominant while automatic intervals improve', () => {
    expect(report.profiles.hoverUnlocked.averageAutomaticWeaponHits).toBeGreaterThan(0)
    expect(report.profiles.hoverInterval1.averageAutomaticWeaponHits).toBeGreaterThan(
      report.profiles.hoverUnlocked.averageAutomaticWeaponHits,
    )
    expect(report.profiles.hoverInterval2.averageAutomaticWeaponHits).toBeGreaterThan(
      report.profiles.hoverInterval1.averageAutomaticWeaponHits,
    )
    expect(report.profiles.hoverInterval3.averageAutomaticWeaponHits).toBeGreaterThan(
      report.profiles.hoverInterval2.averageAutomaticWeaponHits,
    )
    expect(report.profiles.allMaximum.manualWeaponDamageShare).toBeGreaterThanOrEqual(
      balanceSimulationConfig.targets.permanentUpgrades
        .minimumMaximumProfileManualDamageShare,
    )
    expect(report.profiles.allMaximum.automaticWeaponDamageShare).toBeLessThanOrEqual(
      balanceSimulationConfig.targets.permanentUpgrades
        .maximumAutomaticDamageShare,
    )
  })

  it('uses the third slot and keeps maximum income growth inside its target', () => {
    expect(report.profiles.equipmentSlot3.equipmentSlotCount).toBe(3)
    expect(
      report.profiles.equipmentSlot3.averageThirdSlotActivationTimeMs,
    ).not.toBeNull()
    const incomeIncreaseRatio =
      report.profiles.allMaximum.averageTotalIncome /
        report.profiles.allZero.averageTotalIncome -
      1
    expect(incomeIncreaseRatio).toBeGreaterThanOrEqual(0)
    expect(incomeIncreaseRatio).toBeLessThanOrEqual(
      balanceSimulationConfig.targets.permanentUpgrades
        .maximumTotalIncomeIncreaseRatio,
    )
  })

  it('keeps simulated purchase routes inside the configured pacing targets', () => {
    const targets = balanceSimulationConfig.targets.permanentUpgrades
    const firstHoverPurchase = report.purchaseRoutes.hoverFirst.purchasedAtRound[0]

    expect(firstHoverPurchase.round).toBeLessThanOrEqual(
      targets.maximumFirstHoverPurchaseRounds,
    )
    expect(
      report.purchaseRoutes.directSlot.purchasedAtRound[0].round,
    ).toBeLessThanOrEqual(targets.maximumDirectSlotPurchaseRounds)
    for (const route of Object.values(report.purchaseRoutes)) {
      expect(route.sampleCount).toBe(balanceSimulationConfig.seeds.length)
      expect(route.totalRoundDistribution.p10).toBeLessThanOrEqual(
        route.totalRoundDistribution.p50,
      )
      expect(route.totalRoundDistribution.p50).toBeLessThanOrEqual(
        route.totalRoundDistribution.p90,
      )
      expect(route.totalRounds).toBeLessThanOrEqual(
        targets.maximumAllUpgradePurchaseRounds,
      )
    }
    const weaponRoute = report.purchaseRoutes.weaponFirst
    expect(
      weaponRoute.firstWeaponPurchaseRoundDistribution.average,
    ).toBeGreaterThanOrEqual(
      balanceSimulationConfig.targets.weapons.firstPurchaseRounds.minimum,
    )
    expect(
      weaponRoute.firstWeaponPurchaseRoundDistribution.average,
    ).toBeLessThanOrEqual(
      balanceSimulationConfig.targets.weapons.firstPurchaseRounds.maximum,
    )
    expect(
      weaponRoute.secondWeaponAdditionalRoundsDistribution.average,
    ).toBeGreaterThanOrEqual(
      balanceSimulationConfig.targets.weapons.secondPurchaseAdditionalRounds
        .minimum,
    )
    expect(
      weaponRoute.secondWeaponAdditionalRoundsDistribution.average,
    ).toBeLessThanOrEqual(
      balanceSimulationConfig.targets.weapons.secondPurchaseAdditionalRounds
        .maximum,
    )
  })
})
