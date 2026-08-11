import type { EquipmentId } from './equipmentConfig'
import type { PermanentUpgradeLevels } from '../types/game'

export const balanceSimulationConfig = {
  configVersion: 'low-density-meteor-v17',
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
  backpackManagementPolicies: {
    noSwitching: { prioritizedEquipmentIds: [] },
    swordPriority: { prioritizedEquipmentIds: ['sword', 'ring'] },
    ringPriority: { prioritizedEquipmentIds: ['ring', 'sword'] },
  } satisfies Record<
    string,
    { prioritizedEquipmentIds: readonly EquipmentId[] }
  >,
  permanentUpgradeProfiles: {
    allZero: {
      levels: levels(0, 0, 0),
      initialLoadout: [],
    },
    hoverUnlocked: {
      levels: levels(1, 0, 0),
      initialLoadout: [],
    },
    hoverInterval1: {
      levels: levels(1, 1, 0),
      initialLoadout: [],
    },
    hoverInterval2: {
      levels: levels(1, 2, 0),
      initialLoadout: [],
    },
    hoverInterval3: {
      levels: levels(1, 3, 0),
      initialLoadout: [],
    },
    equipmentSlot3: {
      levels: levels(0, 0, 1),
      initialLoadout: [],
    },
    equipmentSlot3SwordMix: {
      levels: levels(0, 0, 1),
      initialLoadout: ['sword', 'sword', 'ring'],
    },
    equipmentSlot3RingMix: {
      levels: levels(0, 0, 1),
      initialLoadout: ['ring', 'ring', 'sword'],
    },
    allMaximum: {
      levels: levels(1, 3, 1),
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
      maximumFirstHoverPurchaseRounds: 2,
      maximumDirectSlotPurchaseRounds: 6,
      maximumAllUpgradePurchaseRounds: 30,
    },
    clearRefill: {
      maximumP90EmptyFieldDurationMs: 150,
      maximumRefillTotalIncomeIncreaseRatio: 0.85,
      maximumRepeatedRefillsWithoutIntervention: 0,
      averageRefillsPerRound: { minimum: 3, maximum: 8 },
      minimumAverageEffectiveTargetsAfterRefill: 11.5,
      maximumP90RefillTargetShortfall: 1,
      averageFullClearsPerRound: { minimum: 0.001, maximum: 0.05 },
      weakAverageFullClearsPerRound: { minimum: 0, maximum: 0.05 },
      standardAverageFullClearsPerRound: { minimum: 0, maximum: 0.1 },
      strongAverageFullClearsPerRound: { minimum: 0, maximum: 0.25 },
    },
  },
} as const

function levels(
  hoverAutoAttackUnlock: number,
  hoverAutoAttackInterval: number,
  equipmentSlots: number,
): PermanentUpgradeLevels {
  return {
    hoverAutoAttackUnlock,
    hoverAutoAttackInterval,
    equipmentSlots,
  }
}
