export const effectCardConfig = {
  ejection: {
    durationMs: 160,
    ejectionOffsetXPixels: 30,
    ejectionOffsetYPixels: -38,
    ejectionRotationRadians: 0.22,
  },
  thunder: {
    carrierSpawnChance: 0.06,
    initialStrikeCount: 1,
    initialWeaponDamageMultiplier: 3,
    animationDurationMs: 450,
    spriteSheet: {
      assetLabel: 'effects/thunder',
      sourceWidthPixels: 792,
      sourceHeightPixels: 256,
      frameWidthPixels: 88,
      frameHeightPixels: 256,
      frameCount: 9,
    },
  },
} as const
