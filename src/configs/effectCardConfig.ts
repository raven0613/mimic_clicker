import type {
  AttachedCardFrameId,
  AttachedCardRarity,
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
  tornado: {
    carrierSpawnChance: 0.06,
    initialTornadoCount: 1,
    initialWeaponDamageMultiplier: 0.5,
    displayScale: 0.75,
    damageAreaHeightRatio: 0.65,
    damageIntervalPerTargetMs: 500,
    startAnimationDurationMs: 400,
    runAnimationCycleDurationMs: 240,
    runDurationMs: 3_000,
    endAnimationDurationMs: 400,
    movementSpeedPixelsPerSecond: 140,
    minimumTurnIntervalMs: 500,
    maximumTurnIntervalMs: 1_000,
    maximumTurnRadians: Math.PI / 3,
    multipleSpawnDirectionJitterRadians: Math.PI / 18,
    spriteSheets: {
      start: {
        assetLabel: 'effects/tornado_start',
        sourceWidthPixels: 600,
        sourceHeightPixels: 265,
        frameWidthPixels: 120,
        frameHeightPixels: 265,
        frameCount: 5,
      },
      run: {
        assetLabel: 'effects/tornado_run',
        sourceWidthPixels: 360,
        sourceHeightPixels: 265,
        frameWidthPixels: 120,
        frameHeightPixels: 265,
        frameCount: 3,
      },
      end: {
        assetLabel: 'effects/tornado_end',
        sourceWidthPixels: 600,
        sourceHeightPixels: 265,
        frameWidthPixels: 120,
        frameHeightPixels: 265,
        frameCount: 5,
      },
    },
  },
} as const

export const effectCardDefinitions = [
  {
    id: 'thunder',
    frameId: 'normal',
    rarity: 'N',
    chance: effectCardConfig.thunder.carrierSpawnChance,
  },
  {
    id: 'meteorite',
    frameId: 'normal',
    rarity: 'UR',
    chance: effectCardConfig.meteorite.carrierSpawnChance,
  },
  {
    id: 'tornado',
    frameId: 'normal',
    rarity: 'SR',
    chance: effectCardConfig.tornado.carrierSpawnChance,
  },
] as const satisfies readonly {
  id: 'thunder' | 'meteorite' | 'tornado'
  frameId: AttachedCardFrameId
  rarity: AttachedCardRarity
  chance: number
}[]
