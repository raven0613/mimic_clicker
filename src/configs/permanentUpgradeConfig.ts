export const permanentUpgradeConfig = {
  hoverAutoAttack: {
    unlockCostGold: 600,
    intervalMsByLevel: [1500, 1200, 900, 600],
    intervalCostGoldByLevel: [900, 1400, 1800],
    hitEffectOffset: {
      x: -28,
      y: 22,
    },
    hitEffectTintColor: '#67d9ff',
  },
  equipmentSlots: {
    additionalSlotCountByLevel: [0, 1],
    costGoldByLevel: [2200],
  },
} as const
