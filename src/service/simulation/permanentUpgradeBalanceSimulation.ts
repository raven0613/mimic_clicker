import { balanceSimulationConfig } from '../../configs/balanceSimulationConfig'
import { equipmentDefinitions } from '../../configs/equipmentConfig'
import type { JackpotOutcome, PermanentUpgradeId, ProgressData } from '../../types/game'
import { createInitialProgress } from '../progression/createInitialProgress'
import { calculateJackpotReward } from '../progression/progression'
import {
  createPermanentUpgradeSnapshot,
  purchasePermanentUpgrade,
} from '../progression/permanentUpgrades'
import { calculateEquipmentSale } from '../settlement/equipmentSale'
import { selectWeightedMimicId } from '../spawn/spawn'
import { selectSimulatedAttachedContent, selectSimulatedJackpotAttachedContent } from './attachedCardSimulation'
import {
  runEconomyBaselineStageIncome,
  stagePools,
  type StageKey,
} from './balanceSimulation'
import { createSeededRandom } from './createSeededRandom'
import { simulateEquipmentCombatRound } from './equipmentBalanceSimulation'
import { simulateSpawnStream } from './spawnStreamSimulation'

export type PermanentUpgradeProfileKey =
  keyof typeof balanceSimulationConfig.permanentUpgradeProfiles

export interface PermanentUpgradeProfileMetrics {
  caseCount: number
  weaponDamage: number
  automaticAttackIntervalMs: number | null
  equipmentSlotCount: number
  averageManualWeaponHits: number
  averageAutomaticWeaponHits: number
  manualWeaponDamageShare: number
  automaticWeaponDamageShare: number
  averageTotalIncome: number
  stageAverageTotalIncome: Record<StageKey, number>
  averageThirdSlotActivationTimeMs: number | null
}

export interface PermanentUpgradeBalanceReport {
  configVersion: string
  caseCount: number
  profiles: Record<
    PermanentUpgradeProfileKey,
    PermanentUpgradeProfileMetrics
  >
  purchaseRoutes: Record<PurchaseRouteKey, PurchaseRouteMetrics>
  economyBaselineStageIncome: Record<StageKey, number>
}

export type PurchaseRouteKey = keyof typeof purchaseRoutes

export interface PurchaseRouteMetrics {
  totalRounds: number
  purchasedAtRound: Array<{
    upgradeId: PermanentUpgradeId
    level: number
    round: number
  }>
}

interface PermanentUpgradeSimulatedCase {
  profile: PermanentUpgradeProfileKey
  stage: StageKey
  manualWeaponHits: number
  automaticWeaponHits: number
  manualWeaponDamage: number
  automaticWeaponDamage: number
  totalIncome: number
  thirdSlotActivationTimeTotalMs: number
  thirdSlotActivationCount: number
}

export function runPermanentUpgradeBalanceSimulation(): PermanentUpgradeBalanceReport {
  const cases: PermanentUpgradeSimulatedCase[] = []
  const profiles = Object.keys(
    balanceSimulationConfig.permanentUpgradeProfiles,
  ) as PermanentUpgradeProfileKey[]
  for (const profile of profiles) {
    for (const stage of Object.keys(stagePools) as StageKey[]) {
      for (const clickRate of Object.values(
        balanceSimulationConfig.playerClickRatesPerSecond,
      )) {
        for (const accuracy of Object.values(
          balanceSimulationConfig.accuracyRates,
        )) {
          for (const jackpotCase of balanceSimulationConfig.jackpotCases) {
            for (const seed of balanceSimulationConfig.seeds) {
              cases.push(
                simulateCase(
                  profile,
                  stage,
                  clickRate,
                  accuracy,
                  jackpotCase,
                  seed,
                ),
              )
            }
          }
        }
      }
    }
  }

  const profileReport = Object.fromEntries(
    profiles.map((profile) => [
      profile,
      createProfileMetrics(
        profile,
        cases.filter((result) => result.profile === profile),
      ),
    ]),
  ) as PermanentUpgradeBalanceReport['profiles']
  const economyBaselineStageIncome = runEconomyBaselineStageIncome()
  return {
    configVersion: balanceSimulationConfig.configVersion,
    caseCount: cases.length,
    profiles: profileReport,
    economyBaselineStageIncome,
    purchaseRoutes: Object.fromEntries(
      (Object.keys(purchaseRoutes) as PurchaseRouteKey[]).map((routeKey) => [
        routeKey,
        simulatePurchaseRoute(
          purchaseRoutes[routeKey],
          profileReport,
          economyBaselineStageIncome,
        ),
      ]),
    ) as Record<PurchaseRouteKey, PurchaseRouteMetrics>,
  }
}

const purchaseRoutes = {
  weaponFirst: [
    'weaponDamage',
    'weaponDamage',
    'weaponDamage',
    'hoverAutoAttackUnlock',
    'hoverAutoAttackInterval',
    'hoverAutoAttackInterval',
    'hoverAutoAttackInterval',
    'equipmentSlots',
  ],
  hoverFirst: [
    'hoverAutoAttackUnlock',
    'hoverAutoAttackInterval',
    'hoverAutoAttackInterval',
    'hoverAutoAttackInterval',
    'weaponDamage',
    'weaponDamage',
    'weaponDamage',
    'equipmentSlots',
  ],
  directSlot: [
    'equipmentSlots',
    'weaponDamage',
    'weaponDamage',
    'weaponDamage',
    'hoverAutoAttackUnlock',
    'hoverAutoAttackInterval',
    'hoverAutoAttackInterval',
    'hoverAutoAttackInterval',
  ],
  balanced: [
    'weaponDamage',
    'hoverAutoAttackUnlock',
    'weaponDamage',
    'hoverAutoAttackInterval',
    'weaponDamage',
    'hoverAutoAttackInterval',
    'equipmentSlots',
    'hoverAutoAttackInterval',
  ],
} as const satisfies Record<string, readonly PermanentUpgradeId[]>

function simulateCase(
  profileKey: PermanentUpgradeProfileKey,
  stage: StageKey,
  clickRate: number,
  accuracy: number,
  jackpotCase: JackpotOutcome,
  seed: number,
): PermanentUpgradeSimulatedCase {
  const profile = balanceSimulationConfig.permanentUpgradeProfiles[profileKey]
  const snapshot = createPermanentUpgradeSnapshot(profile.levels)
  const pool = stagePools[stage]
  const spawnMetrics = simulateSpawnStream(pool, seed)
  const random = createSeededRandom(seed ^ 0x27d4eb2d)
  const shellMimicId = selectWeightedMimicId(pool, random)
  const metrics = simulateEquipmentCombatRound({
    ordinaryMimics: spawnMetrics.spawnedMimics,
    shellMimicId,
    shellContent: selectSimulatedAttachedContent(shellMimicId, random),
    jackpotContent: selectSimulatedJackpotAttachedContent(random),
    jackpotReward: calculateJackpotReward(pool),
    jackpotCase,
    initialLoadout: profile.initialLoadout,
    baseWeaponDamage: snapshot.weaponDamage,
    automaticAttackIntervalMs: snapshot.hoverAutoAttack.isUnlocked
      ? snapshot.hoverAutoAttack.intervalMs
      : null,
    equipmentSlotCount: snapshot.equipmentSlotCount,
    clickRate,
    accuracy,
    random,
  })
  const soldEquipment = equipmentDefinitions.flatMap(({ id }) =>
    Array.from({ length: metrics.successfulDrops[id] }, () => id),
  )
  const jackpotIncome = metrics.jackpotDefeated
    ? calculateJackpotReward(pool)
    : 0
  return {
    profile: profileKey,
    stage,
    manualWeaponHits: metrics.manualWeaponHits,
    automaticWeaponHits: metrics.automaticWeaponHits,
    manualWeaponDamage: metrics.manualWeaponDamage,
    automaticWeaponDamage: metrics.automaticWeaponDamage,
    totalIncome:
      metrics.ordinaryIncome +
      jackpotIncome +
      calculateEquipmentSale(soldEquipment).totalGold,
    thirdSlotActivationTimeTotalMs: metrics.thirdSlotActivationTimeTotalMs,
    thirdSlotActivationCount: metrics.thirdSlotActivationCount,
  }
}

function createProfileMetrics(
  profileKey: PermanentUpgradeProfileKey,
  cases: readonly PermanentUpgradeSimulatedCase[],
): PermanentUpgradeProfileMetrics {
  const profile = balanceSimulationConfig.permanentUpgradeProfiles[profileKey]
  const snapshot = createPermanentUpgradeSnapshot(profile.levels)
  const manualDamage = sum(cases.map(({ manualWeaponDamage }) => manualWeaponDamage))
  const automaticDamage = sum(
    cases.map(({ automaticWeaponDamage }) => automaticWeaponDamage),
  )
  const totalWeaponDamage = manualDamage + automaticDamage
  const thirdSlotActivationCount = sum(
    cases.map(({ thirdSlotActivationCount }) => thirdSlotActivationCount),
  )
  return {
    caseCount: cases.length,
    weaponDamage: snapshot.weaponDamage,
    automaticAttackIntervalMs: snapshot.hoverAutoAttack.isUnlocked
      ? snapshot.hoverAutoAttack.intervalMs
      : null,
    equipmentSlotCount: snapshot.equipmentSlotCount,
    averageManualWeaponHits: average(
      cases.map(({ manualWeaponHits }) => manualWeaponHits),
    ),
    averageAutomaticWeaponHits: average(
      cases.map(({ automaticWeaponHits }) => automaticWeaponHits),
    ),
    manualWeaponDamageShare:
      totalWeaponDamage === 0 ? 0 : manualDamage / totalWeaponDamage,
    automaticWeaponDamageShare:
      totalWeaponDamage === 0 ? 0 : automaticDamage / totalWeaponDamage,
    averageTotalIncome: average(cases.map(({ totalIncome }) => totalIncome)),
    stageAverageTotalIncome: Object.fromEntries(
      (Object.keys(stagePools) as StageKey[]).map((stage) => [
        stage,
        average(
          cases
            .filter((result) => result.stage === stage)
            .map(({ totalIncome }) => totalIncome),
        ),
      ]),
    ) as Record<StageKey, number>,
    averageThirdSlotActivationTimeMs:
      thirdSlotActivationCount === 0
        ? null
        : sum(
            cases.map(
              ({ thirdSlotActivationTimeTotalMs }) =>
                thirdSlotActivationTimeTotalMs,
            ),
          ) / thirdSlotActivationCount,
  }
}

function simulatePurchaseRoute(
  route: readonly PermanentUpgradeId[],
  profiles: PermanentUpgradeBalanceReport['profiles'],
  economyBaselineStageIncome: Record<StageKey, number>,
): PurchaseRouteMetrics {
  let progress = createInitialProgress()
  const purchasedAtRound: PurchaseRouteMetrics['purchasedAtRound'] = []
  let nextPurchaseIndex = 0
  let round = 0
  while (nextPurchaseIndex < route.length) {
    round += 1
    if (round > 100) {
      throw new Error('Permanent upgrade purchase route exceeded 100 rounds')
    }
    const stage = stageForRound(round)
    progress = {
      ...progress,
      gold:
        progress.gold +
        Math.round(
          projectStageIncome(
            progress,
            stage,
            profiles,
            economyBaselineStageIncome,
          ),
        ),
    }
    while (nextPurchaseIndex < route.length) {
      const upgradeId = route[nextPurchaseIndex]
      const purchase = purchasePermanentUpgrade(progress, upgradeId)
      if (purchase.status === 'insufficientGold') break
      if (purchase.status !== 'purchased') {
        throw new Error(
          `Purchase route could not buy ${upgradeId}: ${purchase.status}`,
        )
      }
      progress = purchase.progress
      purchasedAtRound.push({
        upgradeId,
        level: progress.permanentUpgrades[upgradeId],
        round,
      })
      nextPurchaseIndex += 1
    }
  }
  return { totalRounds: round, purchasedAtRound }
}

function projectStageIncome(
  progress: ProgressData,
  stage: StageKey,
  profiles: PermanentUpgradeBalanceReport['profiles'],
  economyBaselineStageIncome: Record<StageKey, number>,
): number {
  const levels = progress.permanentUpgrades
  if (
    levels.weaponDamage === 3 &&
    levels.hoverAutoAttackUnlock === 1 &&
    levels.hoverAutoAttackInterval === 3 &&
    levels.equipmentSlots === 1
  ) {
    return (
      economyBaselineStageIncome[stage] +
      profiles.allMaximum.stageAverageTotalIncome[stage] -
      profiles.allZero.stageAverageTotalIncome[stage]
    )
  }

  const baseline = profiles.allZero.stageAverageTotalIncome[stage]
  const weaponProfile = (
    ['allZero', 'weaponDamage1', 'weaponDamage2', 'weaponDamage3'] as const
  )[levels.weaponDamage]
  const hoverProfile = levels.hoverAutoAttackUnlock === 0
    ? 'allZero'
    : (
        [
          'hoverUnlocked',
          'hoverInterval1',
          'hoverInterval2',
          'hoverInterval3',
        ] as const
      )[levels.hoverAutoAttackInterval]
  const slotProfile = levels.equipmentSlots === 0 ? 'allZero' : 'equipmentSlot3'
  return (
    economyBaselineStageIncome[stage] +
    (profiles[weaponProfile].stageAverageTotalIncome[stage] - baseline) +
    (profiles[hoverProfile].stageAverageTotalIncome[stage] - baseline) +
    (profiles[slotProfile].stageAverageTotalIncome[stage] - baseline)
  )
}

function stageForRound(round: number): StageKey {
  if (round === 1) return 'normalOnly'
  if (round === 2) return 'normalRare1'
  return 'allMimics'
}

function average(values: readonly number[]): number {
  return sum(values) / Math.max(1, values.length)
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}
