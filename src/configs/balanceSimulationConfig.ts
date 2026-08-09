import type { EquipmentId } from './equipmentConfig'
import type { PermanentUpgradeLevels } from '../types/game'

export const balanceSimulationConfig = {
  configVersion: 'permanent-upgrades-v15',
  seeds: [11, 29, 47, 83, 131, 197, 263, 347, 431, 557, 683, 809],
  field: {
    widthPixels: 1_280,
    heightPixels: 720,
  },
  playerClickRatesPerSecond: {
    slow: 3,
    target: 6,
    fast: 9,
  },
  accuracyRates: {
    low: 0.55,
    target: 0.78,
    high: 0.92,
  },
  jackpotCases: [
    'notRevealed',
    'defeated',
    'escaped',
    'roundExpiredDuringChase',
  ],
  equipmentLoadouts: {
    none: [],
    singleSword: ['sword'],
    singleRing: ['ring'],
    duplicateSword: ['sword', 'sword'],
    duplicateRing: ['ring', 'ring'],
    swordAndRing: ['sword', 'ring'],
  } satisfies Record<string, readonly EquipmentId[]>,
  permanentUpgradeProfiles: {
    allZero: {
      levels: levels(0, 0, 0, 0),
      initialLoadout: [],
    },
    weaponDamage1: {
      levels: levels(1, 0, 0, 0),
      initialLoadout: [],
    },
    weaponDamage2: {
      levels: levels(2, 0, 0, 0),
      initialLoadout: [],
    },
    weaponDamage3: {
      levels: levels(3, 0, 0, 0),
      initialLoadout: [],
    },
    hoverUnlocked: {
      levels: levels(0, 1, 0, 0),
      initialLoadout: [],
    },
    hoverInterval1: {
      levels: levels(0, 1, 1, 0),
      initialLoadout: [],
    },
    hoverInterval2: {
      levels: levels(0, 1, 2, 0),
      initialLoadout: [],
    },
    hoverInterval3: {
      levels: levels(0, 1, 3, 0),
      initialLoadout: [],
    },
    equipmentSlot3: {
      levels: levels(0, 0, 0, 1),
      initialLoadout: [],
    },
    equipmentSlot3SwordMix: {
      levels: levels(0, 0, 0, 1),
      initialLoadout: ['sword', 'sword', 'ring'],
    },
    equipmentSlot3RingMix: {
      levels: levels(0, 0, 0, 1),
      initialLoadout: ['ring', 'ring', 'sword'],
    },
    allMaximum: {
      levels: levels(3, 1, 3, 1),
      initialLoadout: [],
    },
  } satisfies Record<
    string,
    { levels: PermanentUpgradeLevels; initialLoadout: readonly EquipmentId[] }
  >,
  targets: {
    maximumPlacementRejectionRatio: 0.2,
    maximumSpawnShareDeviation: 0.08,
    targetProfileDefeatedMimics: { minimum: 55, maximum: 75 },
    targetProfileJackpotDefeatRate: { minimum: 0.95, maximum: 1 },
    effectCardCarrierRateTolerance: 0.02,
    successfulEquipmentDropsPerRound: {
      sword: { minimum: 4, maximum: 10 },
      ring: { minimum: 1, maximum: 4 },
    },
    maximumAverageEquipmentActivationTimeMs: 3_500,
    equipmentSaleIncomeShare: { minimum: 0.15, maximum: 0.25 },
    permanentUpgrades: {
      maximumAutomaticDamageShare: 0.4,
      minimumMaximumProfileManualDamageShare: 0.55,
      maximumTotalIncomeIncreaseRatio: 1,
      maximumFirstWeaponPurchaseRounds: 1,
      maximumDirectSlotPurchaseRounds: 6,
      maximumAllUpgradePurchaseRounds: 30,
    },
    clearRefill: {
      maximumP90EmptyFieldDurationMs: 150,
      maximumRefillTotalIncomeIncreaseRatio: 0.85,
      maximumRepeatedRefillsWithoutIntervention: 0,
      weakAverageFullClearsPerRound: { minimum: 0, maximum: 0.5 },
      standardAverageFullClearsPerRound: { minimum: 1.5, maximum: 4 },
      strongAverageFullClearsPerRound: { minimum: 7, maximum: 10 },
    },
  },
} as const

function levels(
  weaponDamage: number,
  hoverAutoAttackUnlock: number,
  hoverAutoAttackInterval: number,
  equipmentSlots: number,
): PermanentUpgradeLevels {
  return {
    weaponDamage,
    hoverAutoAttackUnlock,
    hoverAutoAttackInterval,
    equipmentSlots,
  }
}
