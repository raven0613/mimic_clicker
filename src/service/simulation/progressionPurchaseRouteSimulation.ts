import { type WeaponId } from '../../configs/weaponConfig'
import type { PermanentUpgradeId, ProgressData } from '../../types/game'
import { createInitialProgress } from '../progression/createInitialProgress'
import { purchasePermanentUpgrade } from '../progression/permanentUpgrades'
import { purchaseWeapon } from '../progression/weaponProgression'
import type {
  PermanentUpgradeProfileKey,
  PermanentUpgradeProfileMetrics,
} from './permanentUpgradeBalanceSimulation'
import type { StageKey } from './balanceSimulation'

type PurchaseRouteAction =
  | { kind: 'upgrade'; id: PermanentUpgradeId }
  | { kind: 'weapon'; id: WeaponId }

interface PurchasedMilestone {
  itemId: PermanentUpgradeId | WeaponId
  kind: PurchaseRouteAction['kind']
  level: number
  round: number
}

interface PurchaseRouteJourney {
  totalRounds: number
  purchasedAtRound: PurchasedMilestone[]
  firstWeaponPurchaseRound: number
  secondWeaponPurchaseRound: number
  secondWeaponAdditionalRounds: number
}

export interface RoundDistribution {
  average: number
  p10: number
  p50: number
  p90: number
}

export interface PurchaseRouteMetrics extends PurchaseRouteJourney {
  sampleCount: number
  totalRoundDistribution: RoundDistribution
  firstWeaponPurchaseRoundDistribution: RoundDistribution
  secondWeaponAdditionalRoundsDistribution: RoundDistribution
}

export type PurchaseRouteKey = keyof typeof purchaseRoutes

type ProfileMetrics = Record<
  PermanentUpgradeProfileKey,
  PermanentUpgradeProfileMetrics
>
type WeaponStageValues = Record<WeaponId, Record<StageKey, number>>

export function runProgressionPurchaseRouteSimulation(
  profiles: ProfileMetrics,
  economyBaselineStageIncome: WeaponStageValues,
  incomeMultipliers: readonly WeaponStageValues[],
): Record<PurchaseRouteKey, PurchaseRouteMetrics> {
  return Object.fromEntries(
    (Object.keys(purchaseRoutes) as PurchaseRouteKey[]).map((routeKey) => [
      routeKey,
      createRouteMetrics(
        purchaseRoutes[routeKey],
        profiles,
        economyBaselineStageIncome,
        incomeMultipliers,
      ),
    ]),
  ) as Record<PurchaseRouteKey, PurchaseRouteMetrics>
}

const purchaseRoutes = {
  weaponFirst: [
    weapon('lockbreakerHammer'),
    weapon('runicSiegeHammer'),
    upgrade('hoverAutoAttackUnlock'),
    upgrade('equipmentSlots'),
    upgrade('hoverAutoAttackInterval'),
    upgrade('hoverAutoAttackInterval'),
    upgrade('hoverAutoAttackInterval'),
  ],
  hoverFirst: [
    upgrade('hoverAutoAttackUnlock'),
    weapon('lockbreakerHammer'),
    upgrade('hoverAutoAttackInterval'),
    upgrade('hoverAutoAttackInterval'),
    upgrade('hoverAutoAttackInterval'),
    weapon('runicSiegeHammer'),
    upgrade('equipmentSlots'),
  ],
  directSlot: [
    upgrade('equipmentSlots'),
    weapon('lockbreakerHammer'),
    weapon('runicSiegeHammer'),
    upgrade('hoverAutoAttackUnlock'),
    upgrade('hoverAutoAttackInterval'),
    upgrade('hoverAutoAttackInterval'),
    upgrade('hoverAutoAttackInterval'),
  ],
  balanced: [
    weapon('lockbreakerHammer'),
    upgrade('hoverAutoAttackUnlock'),
    upgrade('equipmentSlots'),
    upgrade('hoverAutoAttackInterval'),
    weapon('runicSiegeHammer'),
    upgrade('hoverAutoAttackInterval'),
    upgrade('hoverAutoAttackInterval'),
  ],
} as const satisfies Record<string, readonly PurchaseRouteAction[]>

function createRouteMetrics(
  route: readonly PurchaseRouteAction[],
  profiles: ProfileMetrics,
  economyBaselineStageIncome: WeaponStageValues,
  incomeMultipliers: readonly WeaponStageValues[],
): PurchaseRouteMetrics {
  const journeys = incomeMultipliers.map((multipliers) =>
    simulatePurchaseRoute(
      route,
      profiles,
      economyBaselineStageIncome,
      multipliers,
    ),
  )
  const representative = [...journeys].sort(
    (first, second) => first.totalRounds - second.totalRounds,
  )[Math.floor(journeys.length / 2)]
  return {
    ...representative,
    sampleCount: journeys.length,
    totalRoundDistribution: distribution(
      journeys.map(({ totalRounds }) => totalRounds),
    ),
    firstWeaponPurchaseRoundDistribution: distribution(
      journeys.map(({ firstWeaponPurchaseRound }) => firstWeaponPurchaseRound),
    ),
    secondWeaponAdditionalRoundsDistribution: distribution(
      journeys.map(
        ({ secondWeaponAdditionalRounds }) => secondWeaponAdditionalRounds,
      ),
    ),
  }
}

function simulatePurchaseRoute(
  route: readonly PurchaseRouteAction[],
  profiles: ProfileMetrics,
  economyBaselineStageIncome: WeaponStageValues,
  incomeMultipliers: WeaponStageValues,
): PurchaseRouteJourney {
  let progress = createInitialProgress()
  const purchasedAtRound: PurchasedMilestone[] = []
  let nextPurchaseIndex = 0
  let round = 0
  while (nextPurchaseIndex < route.length) {
    round += 1
    if (round > 100) {
      throw new Error('Progression purchase route exceeded 100 rounds')
    }
    const stage = stageForRound(round)
    progress = {
      ...progress,
      gold:
        progress.gold +
        Math.round(
          projectStageIncome(progress, stage, profiles, economyBaselineStageIncome) *
            incomeMultipliers[progress.equippedWeaponId][stage],
        ),
    }
    while (nextPurchaseIndex < route.length) {
      const action = route[nextPurchaseIndex]
      const purchase =
        action.kind === 'weapon'
          ? purchaseWeapon(progress, action.id)
          : purchasePermanentUpgrade(progress, action.id)
      if (purchase.status === 'insufficientGold') break
      if (purchase.status !== 'purchased') {
        throw new Error(
          `Purchase route could not buy ${action.id}: ${purchase.status}`,
        )
      }
      progress = purchase.progress
      purchasedAtRound.push({
        itemId: action.id,
        kind: action.kind,
        level:
          action.kind === 'weapon'
            ? 1
            : progress.permanentUpgrades[action.id],
        round,
      })
      nextPurchaseIndex += 1
    }
  }
  const weaponPurchases = purchasedAtRound.filter(
    (purchase) => purchase.kind === 'weapon',
  )
  const firstWeaponPurchaseRound = weaponPurchases[0]?.round ?? 0
  const secondWeaponPurchaseRound = weaponPurchases[1]?.round ?? 0
  return {
    totalRounds: round,
    purchasedAtRound,
    firstWeaponPurchaseRound,
    secondWeaponPurchaseRound,
    secondWeaponAdditionalRounds:
      secondWeaponPurchaseRound - firstWeaponPurchaseRound,
  }
}

function projectStageIncome(
  progress: ProgressData,
  stage: StageKey,
  profiles: ProfileMetrics,
  economyBaselineStageIncome: WeaponStageValues,
): number {
  const weaponId = progress.equippedWeaponId
  const levels = progress.permanentUpgrades
  const baseline = profiles.allZero.weaponStageAverageTotalIncome[weaponId][stage]
  if (
    levels.hoverAutoAttackUnlock === 1 &&
    levels.hoverAutoAttackInterval === 3 &&
    levels.equipmentSlots === 1
  ) {
    return (
      economyBaselineStageIncome[weaponId][stage] +
      profiles.allMaximum.weaponStageAverageTotalIncome[weaponId][stage] -
      baseline
    )
  }
  const hoverProfile =
    levels.hoverAutoAttackUnlock === 0
      ? 'allZero'
      : (
          [
            'hoverUnlocked',
            'hoverInterval1',
            'hoverInterval2',
            'hoverInterval3',
          ] as const
        )[levels.hoverAutoAttackInterval]
  const slotProfile =
    levels.equipmentSlots === 0 ? 'allZero' : 'equipmentSlot3'
  return (
    economyBaselineStageIncome[weaponId][stage] +
    profiles[hoverProfile].weaponStageAverageTotalIncome[weaponId][stage] -
    baseline +
    profiles[slotProfile].weaponStageAverageTotalIncome[weaponId][stage] -
    baseline
  )
}

function distribution(values: readonly number[]): RoundDistribution {
  const sorted = [...values].sort((first, second) => first - second)
  return {
    average: average(sorted),
    p10: percentile(sorted, 0.1),
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
  }
}

function percentile(sorted: readonly number[], ratio: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))]
}

function weapon(id: WeaponId): PurchaseRouteAction {
  return { kind: 'weapon', id }
}

function upgrade(id: PermanentUpgradeId): PurchaseRouteAction {
  return { kind: 'upgrade', id }
}

function stageForRound(round: number): StageKey {
  if (round === 1) return 'normalOnly'
  if (round === 2) return 'normalRare1'
  return 'allMimics'
}

function average(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length
}
