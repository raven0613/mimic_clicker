export const balanceSimulationConfig = {
  configVersion: 'per-target-weapon-damage-interval-v8',
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
  targets: {
    maximumPlacementRejectionRatio: 0.2,
    maximumSpawnShareDeviation: 0.08,
    targetProfileDefeatedMimics: { minimum: 42, maximum: 55 },
    targetProfileJackpotDefeatRate: { minimum: 0.95, maximum: 1 },
    effectCardCarrierRateTolerance: 0.02,
  },
} as const
