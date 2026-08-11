import {
  weaponConfig,
  type WeaponDefinition,
  type WeaponId,
} from '../../configs/weaponConfig'
import type { ProgressData, RoundProgressionSnapshot } from '../../types/game'
import { createPermanentUpgradeSnapshot } from './permanentUpgrades'

export type WeaponPurchaseStatus =
  | 'purchased'
  | 'insufficientGold'
  | 'prerequisiteNotMet'
  | 'alreadyOwned'
  | 'unknownWeapon'

export interface WeaponPurchaseResult {
  status: WeaponPurchaseStatus
  progress: ProgressData
}

export type WeaponEquipStatus =
  | 'equipped'
  | 'alreadyEquipped'
  | 'notOwned'
  | 'unknownWeapon'

export interface WeaponEquipResult {
  status: WeaponEquipStatus
  progress: ProgressData
}

export type WeaponShopAvailability =
  | 'equipped'
  | 'owned'
  | 'available'
  | 'insufficientGold'
  | 'prerequisiteNotMet'

export interface WeaponShopOffer {
  definition: WeaponDefinition
  availability: WeaponShopAvailability
  requiredWeaponName: string | null
}

export function findWeaponDefinition(
  weaponId: string,
): WeaponDefinition | null {
  return (
    weaponConfig.definitions.find(({ id }) => id === weaponId) ?? null
  )
}

export function getInitialWeaponDefinition(): WeaponDefinition {
  return requireWeaponDefinition(weaponConfig.initialWeaponId)
}

export function createRoundProgressionSnapshot(
  progress: ProgressData,
): RoundProgressionSnapshot {
  const definition = requireWeaponDefinition(progress.equippedWeaponId)
  return {
    weapon: {
      id: definition.id,
      baseDamage: definition.baseDamage,
    },
    ...createPermanentUpgradeSnapshot(progress.permanentUpgrades),
  }
}

export function purchaseWeapon(
  progress: ProgressData,
  weaponId: string,
): WeaponPurchaseResult {
  const definition = findWeaponDefinition(weaponId)
  if (!definition) return { status: 'unknownWeapon', progress }
  if (progress.ownedWeaponIds.includes(definition.id)) {
    return { status: 'alreadyOwned', progress }
  }
  if (
    definition.requiredWeaponId !== null &&
    !progress.ownedWeaponIds.includes(definition.requiredWeaponId)
  ) {
    return { status: 'prerequisiteNotMet', progress }
  }
  if (progress.gold < definition.priceGold) {
    return { status: 'insufficientGold', progress }
  }

  return {
    status: 'purchased',
    progress: {
      ...progress,
      gold: progress.gold - definition.priceGold,
      ownedWeaponIds: [...progress.ownedWeaponIds, definition.id],
      equippedWeaponId: definition.id,
    },
  }
}

export function equipWeapon(
  progress: ProgressData,
  weaponId: string,
): WeaponEquipResult {
  const definition = findWeaponDefinition(weaponId)
  if (!definition) return { status: 'unknownWeapon', progress }
  if (!progress.ownedWeaponIds.includes(definition.id)) {
    return { status: 'notOwned', progress }
  }
  if (progress.equippedWeaponId === definition.id) {
    return { status: 'alreadyEquipped', progress }
  }
  return {
    status: 'equipped',
    progress: { ...progress, equippedWeaponId: definition.id },
  }
}

export function getWeaponShopOffers(
  progress: ProgressData,
): WeaponShopOffer[] {
  return weaponConfig.definitions.map((definition) => {
    const requiredWeapon =
      definition.requiredWeaponId === null
        ? null
        : requireWeaponDefinition(definition.requiredWeaponId)
    return {
      definition,
      requiredWeaponName: requiredWeapon?.displayName ?? null,
      availability: resolveAvailability(progress, definition),
    }
  })
}

function resolveAvailability(
  progress: ProgressData,
  definition: WeaponDefinition,
): WeaponShopAvailability {
  if (progress.equippedWeaponId === definition.id) return 'equipped'
  if (progress.ownedWeaponIds.includes(definition.id)) return 'owned'
  if (
    definition.requiredWeaponId !== null &&
    !progress.ownedWeaponIds.includes(definition.requiredWeaponId)
  ) {
    return 'prerequisiteNotMet'
  }
  return progress.gold >= definition.priceGold
    ? 'available'
    : 'insufficientGold'
}

function requireWeaponDefinition(weaponId: WeaponId): WeaponDefinition {
  const definition = findWeaponDefinition(weaponId)
  if (!definition) throw new Error(`Unknown configured weapon id: ${weaponId}`)
  return definition
}
