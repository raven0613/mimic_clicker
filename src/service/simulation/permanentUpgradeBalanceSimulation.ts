import { balanceSimulationConfig } from '../../configs/balanceSimulationConfig'
import { equipmentDefinitions } from '../../configs/equipmentConfig'
import { weaponConfig, type WeaponId } from '../../configs/weaponConfig'
import type { JackpotOutcome } from '../../types/game'
import { calculateJackpotReward } from '../progression/progression'
import {
  createPermanentUpgradeSnapshot,
} from '../progression/permanentUpgrades'
import { calculateEquipmentSale } from '../settlement/equipmentSale'
import { selectWeightedMimicId } from '../spawn/spawn'
import { selectSimulatedAttachedContent, selectSimulatedJackpotAttachedContent } from './attachedCardSimulation'
import {
  runBalanceSimulation,
  stagePools,
  type StageKey,
} from './balanceSimulation'
import { createSeededRandom } from './createSeededRandom'
import { simulateEquipmentCombatRound } from './equipmentBalanceSimulation'
import { simulateSpawnStream } from './spawnStreamSimulation'
import {
  runProgressionPurchaseRouteSimulation,
  type PurchaseRouteKey,
  type PurchaseRouteMetrics,
} from './progressionPurchaseRouteSimulation'

export type PermanentUpgradeProfileKey =
  keyof typeof balanceSimulationConfig.permanentUpgradeProfiles

export interface PermanentUpgradeProfileMetrics {
  caseCount: number
  baseWeaponDamageByWeapon: Record<WeaponId, number>
  automaticAttackIntervalMs: number | null
  equipmentSlotCount: number
  averageManualWeaponHits: number
  averageAutomaticWeaponHits: number
  manualWeaponDamageShare: number
  automaticWeaponDamageShare: number
  averageTotalIncome: number
  stageAverageTotalIncome: Record<StageKey, number>
  weaponStageAverageTotalIncome: Record<
    WeaponId,
    Record<StageKey, number>
  >
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
  economyBaselineStageIncome: Record<WeaponId, Record<StageKey, number>>
}

interface PermanentUpgradeSimulatedCase {
  profile: PermanentUpgradeProfileKey
  weaponId: WeaponId
  stage: StageKey
  seed: number
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
    for (const weapon of weaponConfig.definitions) {
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
                    weapon.id,
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
  const baselineWeaponMetrics = runBalanceSimulation().weaponMetrics.byWeapon
  const economyBaselineStageIncome = Object.fromEntries(
    weaponConfig.definitions.map((weapon) => [
      weapon.id,
      Object.fromEntries(
        (Object.keys(stagePools) as StageKey[]).map((stage) => [
          stage,
          baselineWeaponMetrics[weapon.id][stage].averageTotalIncome,
        ]),
      ),
    ]),
  ) as Record<WeaponId, Record<StageKey, number>>
  return {
    configVersion: balanceSimulationConfig.configVersion,
    caseCount: cases.length,
    profiles: profileReport,
    economyBaselineStageIncome,
    purchaseRoutes: runProgressionPurchaseRouteSimulation(
      profileReport,
      economyBaselineStageIncome,
      createIncomeMultipliers(cases),
    ),
  }
}

function simulateCase(
  profileKey: PermanentUpgradeProfileKey,
  weaponId: WeaponId,
  stage: StageKey,
  clickRate: number,
  accuracy: number,
  jackpotCase: JackpotOutcome,
  seed: number,
): PermanentUpgradeSimulatedCase {
  const weaponDefinition = weaponConfig.definitions.find(
    ({ id }) => id === weaponId,
  )
  if (!weaponDefinition) {
    throw new Error(`Unknown simulation weapon: ${weaponId}`)
  }
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
    baseWeaponDamage: weaponDefinition.baseDamage,
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
    weaponId,
    stage,
    seed,
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
  const manualDamage = sum(
    cases.map(({ manualWeaponDamage }) => manualWeaponDamage),
  )
  const automaticDamage = sum(
    cases.map(({ automaticWeaponDamage }) => automaticWeaponDamage),
  )
  const totalWeaponDamage = manualDamage + automaticDamage
  const thirdSlotActivationCount = sum(
    cases.map(({ thirdSlotActivationCount }) => thirdSlotActivationCount),
  )
  return {
    caseCount: cases.length,
    baseWeaponDamageByWeapon: Object.fromEntries(
      weaponConfig.definitions.map((weapon) => [weapon.id, weapon.baseDamage]),
    ) as Record<WeaponId, number>,
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
    weaponStageAverageTotalIncome: Object.fromEntries(
      weaponConfig.definitions.map((weapon) => [
        weapon.id,
        Object.fromEntries(
          (Object.keys(stagePools) as StageKey[]).map((stage) => [
            stage,
            average(
              cases
                .filter(
                  (result) =>
                    result.weaponId === weapon.id && result.stage === stage,
                )
                .map(({ totalIncome }) => totalIncome),
            ),
          ]),
        ),
      ]),
    ) as Record<WeaponId, Record<StageKey, number>>,
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

function createIncomeMultipliers(
  cases: readonly PermanentUpgradeSimulatedCase[],
): Array<Record<WeaponId, Record<StageKey, number>>> {
  const baselineCases = cases.filter(({ profile }) => profile === 'allZero')
  return balanceSimulationConfig.seeds.map((seed) =>
    Object.fromEntries(
      weaponConfig.definitions.map((weapon) => [
        weapon.id,
        Object.fromEntries(
          (Object.keys(stagePools) as StageKey[]).map((stage) => {
            const comparableCases = baselineCases.filter(
              (result) =>
                result.weaponId === weapon.id && result.stage === stage,
            )
            const seedIncome = average(
              comparableCases
                .filter((result) => result.seed === seed)
                .map(({ totalIncome }) => totalIncome),
            )
            return [
              stage,
              seedIncome /
                average(comparableCases.map(({ totalIncome }) => totalIncome)),
            ]
          }),
        ),
      ]),
    ) as Record<WeaponId, Record<StageKey, number>>,
  )
}


function average(values: readonly number[]): number {
  return sum(values) / Math.max(1, values.length)
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}
