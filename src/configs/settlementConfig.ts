import type { AttachedCardRarity } from './attachedCardConfig'

export const settlementConfig = {
  equipmentSale: {
    basePriceGold: 6,
    rarityPriceMultipliers: {
      N: 1,
      R: 2,
      SR: 4.5,
      SSR: 8,
      UR: 16,
    } satisfies Record<AttachedCardRarity, number>,
  },
} as const
