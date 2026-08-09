import type { MimicId } from '../types/game'

export type AttachedCardFrameId = 'normal'
export const glowingAttachedCardRarities = ['R', 'SR', 'SSR', 'UR'] as const
export const attachedCardRarities = [
  'N',
  ...glowingAttachedCardRarities,
] as const
export type AttachedCardRarity = (typeof attachedCardRarities)[number]
export type GlowingAttachedCardRarity =
  (typeof glowingAttachedCardRarities)[number]

interface SolidAttachedCardHaloColorConfig {
  readonly kind: 'solid'
  readonly outlineColor: string
  readonly glowColor: string
}

interface GradientAttachedCardHaloColorConfig {
  readonly kind: 'linearGradient'
  readonly start: Readonly<{ x: number; y: number }>
  readonly end: Readonly<{ x: number; y: number }>
  readonly colorStops: readonly Readonly<{
    offset: number
    color: string
  }>[]
}

export interface AttachedCardHaloConfig {
  readonly color:
  | SolidAttachedCardHaloColorConfig
  | GradientAttachedCardHaloColorConfig
  readonly cornerRadiusPixels: number
  readonly outlineStrokeWidthPixels: number
  readonly glowStrokeWidthPixels: number
  readonly glowOpacity: number
  readonly blurStrengthPixels: number
  readonly blurQuality: number
  readonly blurPaddingPixels: number
  readonly baseOpacityMultiplier: number
  readonly pulseAmplitude: number
  readonly pulsePeriodMs: number
}

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
      countSelectionChances: {
        minimum: 0.5,
        maximum: 0.5,
      },
    },
  },
  haloByRarity: {
    R: {
      color: {
        kind: 'solid',
        outlineColor: '#C9E9FF',
        glowColor: '#6FB7FF',
      },
      cornerRadiusPixels: 5,
      outlineStrokeWidthPixels: 4,
      glowStrokeWidthPixels: 6,
      glowOpacity: 0.62,
      baseOpacityMultiplier: 0.85,
      pulseAmplitude: 0.1,
      pulsePeriodMs: 900,
      blurStrengthPixels: 4,
      blurQuality: 3,
      blurPaddingPixels: 12,
    },
    SR: {
      color: {
        kind: 'solid',
        outlineColor: '#E1C9FF',
        glowColor: '#A66BFF',
      },
      cornerRadiusPixels: 5,
      outlineStrokeWidthPixels: 5,
      glowStrokeWidthPixels: 8,
      glowOpacity: 0.72,
      blurStrengthPixels: 5,
      blurQuality: 3,
      blurPaddingPixels: 14,
      baseOpacityMultiplier: 0.9,
      pulseAmplitude: 0.1,
      pulsePeriodMs: 760,
    },
    SSR: {
      color: {
        kind: 'solid',
        outlineColor: '#FFE268',
        glowColor: '#FFAA2D',
      },
      cornerRadiusPixels: 5,
      outlineStrokeWidthPixels: 5,
      glowStrokeWidthPixels: 9,
      glowOpacity: 0.78,
      blurStrengthPixels: 6,
      blurQuality: 3,
      blurPaddingPixels: 16,
      baseOpacityMultiplier: 0.88,
      pulseAmplitude: 0.12,
      pulsePeriodMs: 820,
    },
    UR: {
      color: {
        kind: 'linearGradient',
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
        colorStops: [
          { offset: 0, color: '#AAFF01' },
          { offset: 0.25, color: '#FF8F01' },
          { offset: 0.5, color: '#FF00AA' },
          { offset: 0.75, color: '#AA00FF' },
          { offset: 1, color: '#00AAFF' },
        ],
      },
      cornerRadiusPixels: 5,
      outlineStrokeWidthPixels: 5,
      glowStrokeWidthPixels: 9,
      glowOpacity: 0.82,
      blurStrengthPixels: 7,
      blurQuality: 3,
      blurPaddingPixels: 18,
      baseOpacityMultiplier: 0.9,
      pulseAmplitude: 0.1,
      pulsePeriodMs: 760,
    },
  } satisfies Record<GlowingAttachedCardRarity, AttachedCardHaloConfig>,
} as const
