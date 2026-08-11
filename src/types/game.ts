import type { EquipmentId } from '../configs/equipmentConfig'
import type { WeaponId } from '../configs/weaponConfig'

export const mimicIds = ['normal', 'rare1', 'rare2'] as const

export type MimicId = (typeof mimicIds)[number]

export const permanentUpgradeIds = [
  'hoverAutoAttackUnlock',
  'hoverAutoAttackInterval',
  'equipmentSlots',
] as const

export type PermanentUpgradeId = (typeof permanentUpgradeIds)[number]

export interface PermanentUpgradeLevels {
  hoverAutoAttackUnlock: number
  hoverAutoAttackInterval: number
  equipmentSlots: number
}

export interface PermanentUpgradeSnapshot {
  hoverAutoAttack: {
    isUnlocked: boolean
    intervalMs: number
  }
  equipmentSlotCount: number
}

export interface WeaponSnapshot {
  id: WeaponId
  baseDamage: number
}

export interface RoundProgressionSnapshot extends PermanentUpgradeSnapshot {
  weapon: WeaponSnapshot
}

export type JackpotOutcome =
  | 'notRevealed'
  | 'defeated'
  | 'escaped'
  | 'roundExpiredDuringChase'

export interface EquipmentSaleGroup {
  equipmentId: EquipmentId
  quantity: number
  unitPriceGold: number
  subtotalGold: number
}

export interface RoundResult {
  combatGold: number
  equipmentSaleGold: number
  totalGold: number
  equipmentSales: EquipmentSaleGroup[]
  defeatedMimics: number
  jackpotOutcome: JackpotOutcome
}

export interface ProgressData {
  schemaVersion: 5
  completedRounds: number
  gold: number
  unlockedMimicIds: MimicId[]
  pendingUnlockMimicIds: MimicId[]
  latestRoundResult: RoundResult | null
  permanentUpgrades: PermanentUpgradeLevels
  ownedWeaponIds: WeaponId[]
  equippedWeaponId: WeaponId
}

export interface RectangleBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface Vector2 {
  x: number
  y: number
}

export interface EquipmentCollectionTargets {
  slotTargets: Array<Vector2 | null>
  backpackTarget: Vector2 | null
}

export type RandomSource = () => number
