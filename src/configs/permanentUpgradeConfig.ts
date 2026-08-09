import { combatConfig } from './combatConfig'

export const permanentUpgradeConfig = {
  weaponDamage: {
    damageByLevel: [
      combatConfig.initialWeaponDamage,
      combatConfig.initialWeaponDamage + 5,
      combatConfig.initialWeaponDamage + 10,
      combatConfig.initialWeaponDamage + 15,
    ],
    costGoldByLevel: [300, 800, 1400],
  },
  hoverAutoAttack: {
    unlockCostGold: 600,
    intervalMsByLevel: [1500, 1200, 900, 600],
    intervalCostGoldByLevel: [900, 1400, 1800],
  },
  equipmentSlots: {
    additionalSlotCountByLevel: [0, 1],
    costGoldByLevel: [2200],
  },
} as const
