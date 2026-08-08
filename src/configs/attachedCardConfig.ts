import type { MimicId } from '../types/game'

export type AttachedCardRarity = 'normal'

export const attachedCardConfig = {
  card: {
    sourceWidthPixels: 264,
    sourceHeightPixels: 328,
    displayWidthPixels: 33,
    displayHeightPixels: 41,
  },
  fan: {
    offsetXPixels: 40,
    offsetYPixels: -62,
    clockwiseRotationRadians: 0.2,
    cardCenterSpacingXPixels: 19,
    cardRotationStepRadians: 0.08,
    outerCardLiftPixels: 3,
  },
  capacity: {
    byMimic: {
      normal: 1,
      rare1: 1,
      rare2: 2,
    } satisfies Record<MimicId, number>,
    jackpot: {
      minimum: 3,
      maximum: 4,
    },
  },
  haloByRarity: {
    normal: {
      gradientColorStops: [
        { offset: 0, color: 'rgba(145, 217, 255, 0.38)' },
        { offset: 0.72, color: 'rgba(145, 217, 255, 0.22)' },
        { offset: 1, color: 'rgba(145, 217, 255, 0)' },
      ],
      outerExpansionPixels: 5,
      baseOpacityMultiplier: 0.85,
      pulseAmplitude: 0.15,
      pulsePeriodMs: 900,
    },
  } satisfies Record<AttachedCardRarity, object>,
} as const
