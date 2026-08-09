import { equipmentConfig } from '../../configs/equipmentConfig'
import { permanentUpgradeConfig } from '../../configs/permanentUpgradeConfig'
import type {
  PermanentUpgradeId,
  PermanentUpgradeLevels,
  PermanentUpgradeSnapshot,
  ProgressData,
} from '../../types/game'

export type PermanentUpgradePurchaseStatus =
  | 'purchased'
  | 'insufficientGold'
  | 'maximumLevel'
  | 'prerequisiteNotMet'

export interface PermanentUpgradePurchaseResult {
  status: PermanentUpgradePurchaseStatus
  progress: ProgressData
}

export type PermanentUpgradeShopLane =
  | 'weaponDamage'
  | 'hoverAutoAttack'
  | 'equipmentSlots'

export interface PermanentUpgradeShopOffer {
  lane: PermanentUpgradeShopLane
  purchaseId: PermanentUpgradeId
  currentLevel: number
  maximumLevel: number
  currentValue: number | boolean
  nextValue: number | boolean | null
  costGold: number | null
  availability: 'available' | 'insufficientGold' | 'maximumLevel'
}

export function createInitialPermanentUpgradeLevels(): PermanentUpgradeLevels {
  return {
    weaponDamage: 0,
    hoverAutoAttackUnlock: 0,
    hoverAutoAttackInterval: 0,
    equipmentSlots: 0,
  }
}

export function createPermanentUpgradeSnapshot(
  levels: PermanentUpgradeLevels,
): PermanentUpgradeSnapshot {
  return {
    weaponDamage: getLevelValue(
      permanentUpgradeConfig.weaponDamage.damageByLevel,
      levels.weaponDamage,
      'weapon damage',
    ),
    hoverAutoAttack: {
      isUnlocked: getLevelValue(
        [false, true],
        levels.hoverAutoAttackUnlock,
        'hover automatic attack unlock',
      ),
      intervalMs: getLevelValue(
        permanentUpgradeConfig.hoverAutoAttack.intervalMsByLevel,
        levels.hoverAutoAttackInterval,
        'hover automatic attack interval',
      ),
    },
    equipmentSlotCount: resolveEquipmentSlotCount(levels.equipmentSlots),
  }
}

export function resolveEquipmentSlotCount(
  level: number,
  additionalSlotCountByLevel: readonly number[] =
    permanentUpgradeConfig.equipmentSlots.additionalSlotCountByLevel,
): number {
  return (
    equipmentConfig.initialSlotCount +
    getLevelValue(additionalSlotCountByLevel, level, 'equipment slots')
  )
}

export function purchasePermanentUpgrade(
  progress: ProgressData,
  upgradeId: PermanentUpgradeId,
): PermanentUpgradePurchaseResult {
  if (
    upgradeId === 'hoverAutoAttackInterval' &&
    progress.permanentUpgrades.hoverAutoAttackUnlock === 0
  ) {
    return { status: 'prerequisiteNotMet', progress }
  }

  const currentLevel = progress.permanentUpgrades[upgradeId]
  const costs = getCosts(upgradeId)
  if (currentLevel >= costs.length) {
    return { status: 'maximumLevel', progress }
  }

  const costGold = costs[currentLevel]
  if (progress.gold < costGold) {
    return { status: 'insufficientGold', progress }
  }

  return {
    status: 'purchased',
    progress: {
      ...progress,
      gold: progress.gold - costGold,
      permanentUpgrades: {
        ...progress.permanentUpgrades,
        [upgradeId]: currentLevel + 1,
      },
    },
  }
}

export function getPermanentUpgradeShopOffers(
  progress: ProgressData,
): PermanentUpgradeShopOffer[] {
  const levels = progress.permanentUpgrades
  const weaponOffer = createShopOffer({
    lane: 'weaponDamage',
    purchaseId: 'weaponDamage',
    currentLevel: levels.weaponDamage,
    maximumLevel:
      permanentUpgradeConfig.weaponDamage.damageByLevel.length - 1,
    currentValue: getLevelValue(
      permanentUpgradeConfig.weaponDamage.damageByLevel,
      levels.weaponDamage,
      'weapon damage',
    ),
    nextValue:
      permanentUpgradeConfig.weaponDamage.damageByLevel[
        levels.weaponDamage + 1
      ] ?? null,
    costGold:
      permanentUpgradeConfig.weaponDamage.costGoldByLevel[
        levels.weaponDamage
      ] ?? null,
    gold: progress.gold,
  })

  const hoverUnlocked = levels.hoverAutoAttackUnlock === 1
  const hoverCurrentLevel = hoverUnlocked
    ? levels.hoverAutoAttackInterval + 1
    : 0
  const hoverMaximumLevel =
    permanentUpgradeConfig.hoverAutoAttack.intervalMsByLevel.length
  const hoverNextInterval = hoverUnlocked
    ? permanentUpgradeConfig.hoverAutoAttack.intervalMsByLevel[
        levels.hoverAutoAttackInterval + 1
      ] ?? null
    : permanentUpgradeConfig.hoverAutoAttack.intervalMsByLevel[0]
  const hoverCost = hoverUnlocked
    ? permanentUpgradeConfig.hoverAutoAttack.intervalCostGoldByLevel[
        levels.hoverAutoAttackInterval
      ] ?? null
    : permanentUpgradeConfig.hoverAutoAttack.unlockCostGold
  const hoverOffer = createShopOffer({
    lane: 'hoverAutoAttack',
    purchaseId: hoverUnlocked
      ? 'hoverAutoAttackInterval'
      : 'hoverAutoAttackUnlock',
    currentLevel: hoverCurrentLevel,
    maximumLevel: hoverMaximumLevel,
    currentValue: hoverUnlocked
      ? permanentUpgradeConfig.hoverAutoAttack.intervalMsByLevel[
          levels.hoverAutoAttackInterval
        ]
      : false,
    nextValue: hoverNextInterval,
    costGold: hoverCost,
    gold: progress.gold,
  })

  const slotOffer = createShopOffer({
    lane: 'equipmentSlots',
    purchaseId: 'equipmentSlots',
    currentLevel: levels.equipmentSlots,
    maximumLevel:
      permanentUpgradeConfig.equipmentSlots.additionalSlotCountByLevel.length -
      1,
    currentValue: resolveEquipmentSlotCount(levels.equipmentSlots),
    nextValue:
      levels.equipmentSlots + 1 <
      permanentUpgradeConfig.equipmentSlots.additionalSlotCountByLevel.length
        ? resolveEquipmentSlotCount(levels.equipmentSlots + 1)
        : null,
    costGold:
      permanentUpgradeConfig.equipmentSlots.costGoldByLevel[
        levels.equipmentSlots
      ] ?? null,
    gold: progress.gold,
  })

  return [weaponOffer, hoverOffer, slotOffer]
}

function createShopOffer(input: Omit<PermanentUpgradeShopOffer, 'availability'> & {
  gold: number
}): PermanentUpgradeShopOffer {
  const { gold, ...offer } = input
  const availability =
    offer.costGold === null
      ? 'maximumLevel'
      : gold >= offer.costGold
        ? 'available'
        : 'insufficientGold'
  return { ...offer, availability }
}

function getCosts(upgradeId: PermanentUpgradeId): readonly number[] {
  switch (upgradeId) {
    case 'weaponDamage':
      return permanentUpgradeConfig.weaponDamage.costGoldByLevel
    case 'hoverAutoAttackUnlock':
      return [permanentUpgradeConfig.hoverAutoAttack.unlockCostGold]
    case 'hoverAutoAttackInterval':
      return permanentUpgradeConfig.hoverAutoAttack.intervalCostGoldByLevel
    case 'equipmentSlots':
      return permanentUpgradeConfig.equipmentSlots.costGoldByLevel
  }
}

function getLevelValue<T>(
  values: readonly T[],
  level: number,
  label: string,
): T {
  if (!Number.isInteger(level) || level < 0 || level >= values.length) {
    throw new Error(`Invalid ${label} permanent upgrade level: ${level}`)
  }
  return values[level]
}
