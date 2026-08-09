import type {
  AttachedCardFrameId,
  EffectCardRarity,
} from './attachedCardConfig'

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
  meteorite: {
    carrierSpawnChance: 0.06,
    initialMeteoriteCount: 2,
    initialWeaponDamageMultiplier: 4,
    displayScale: 0.75,
    damageAreaWidthMultiplier: 1.05,
    rotationRadians: Math.PI / 4,
    entryOutsideMarginPixels: 1,
    flightSpeedPixelsPerSecond: 800,
    animationCycleDurationMs: 300,
    minimumLaunchIntervalMs: 200,
    maximumLaunchIntervalMs: 300,
    explosionAnimationDurationMs: 360,
    spriteSheet: {
      assetLabel: 'effects/meteorite',
      sourceWidthPixels: 1_410,
      sourceHeightPixels: 500,
      frameWidthPixels: 235,
      frameHeightPixels: 500,
      frameCount: 6,
    },
    explosionSpriteSheet: {
      assetLabel: 'effects/explode',
      sourceWidthPixels: 1_536,
      sourceHeightPixels: 240,
      frameWidthPixels: 256,
      frameHeightPixels: 240,
      frameCount: 6,
    },
  },
} as const

export const effectCardDefinitions = [
  {
    id: 'thunder',
    frameId: 'normal',
    rarity: 'normal',
    chance: effectCardConfig.thunder.carrierSpawnChance,
  },
  {
    id: 'meteorite',
    frameId: 'normal',
    rarity: 'ssr',
    chance: effectCardConfig.meteorite.carrierSpawnChance,
  },
] as const satisfies readonly {
  id: 'thunder' | 'meteorite'
  frameId: AttachedCardFrameId
  rarity: EffectCardRarity
  chance: number
}[]
