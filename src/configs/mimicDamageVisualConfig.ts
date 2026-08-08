export interface MimicCrackPoint {
  xRatio: number
  yRatio: number
}

export type MimicCrackPath = readonly MimicCrackPoint[]

export interface MimicCrackPattern {
  subtlePaths: readonly MimicCrackPath[]
  severeExtensionPaths: readonly MimicCrackPath[]
}

export const mimicDamageVisualConfig = {
  crackStages: {
    subtleMaximumHealthRatio: 0.7,
    severeMaximumHealthRatio: 0.35,
  },
  subtleStyle: {
    darkColor: 0x24130f,
    darkAlpha: 0.76,
    darkWidthPixels: 1.35,
    highlightColor: 0xffe7ad,
    highlightAlpha: 0.34,
    highlightWidthPixels: 0.7,
    highlightOffsetPixels: 0.65,
  },
  severeStyle: {
    darkColor: 0x190b09,
    darkAlpha: 0.92,
    darkWidthPixels: 2.2,
    highlightColor: 0xffdf98,
    highlightAlpha: 0.48,
    highlightWidthPixels: 0.9,
    maximumEdgeOffsetPixels: 2,
  },
  patterns: [
    {
      subtlePaths: [
        [
          { xRatio: -0.05, yRatio: -0.42 },
          { xRatio: -0.02, yRatio: -0.29 },
          { xRatio: -0.1, yRatio: -0.18 },
          { xRatio: -0.04, yRatio: -0.04 },
        ],
        [
          { xRatio: -0.1, yRatio: -0.18 },
          { xRatio: -0.2, yRatio: -0.12 },
        ],
      ],
      severeExtensionPaths: [
        [
          { xRatio: -0.04, yRatio: -0.04 },
          { xRatio: 0.04, yRatio: 0.09 },
          { xRatio: -0.02, yRatio: 0.22 },
          { xRatio: 0.08, yRatio: 0.4 },
        ],
        [
          { xRatio: 0.04, yRatio: 0.09 },
          { xRatio: 0.18, yRatio: 0.04 },
          { xRatio: 0.25, yRatio: 0.12 },
        ],
        [
          { xRatio: -0.02, yRatio: 0.22 },
          { xRatio: -0.17, yRatio: 0.29 },
          { xRatio: -0.22, yRatio: 0.39 },
        ],
      ],
    },
    {
      subtlePaths: [
        [
          { xRatio: -0.4, yRatio: -0.24 },
          { xRatio: -0.28, yRatio: -0.17 },
          { xRatio: -0.18, yRatio: -0.2 },
          { xRatio: -0.08, yRatio: -0.08 },
        ],
        [
          { xRatio: -0.18, yRatio: -0.2 },
          { xRatio: -0.14, yRatio: -0.34 },
        ],
      ],
      severeExtensionPaths: [
        [
          { xRatio: -0.08, yRatio: -0.08 },
          { xRatio: 0.03, yRatio: -0.01 },
          { xRatio: 0.13, yRatio: 0.12 },
          { xRatio: 0.34, yRatio: 0.27 },
        ],
        [
          { xRatio: 0.03, yRatio: -0.01 },
          { xRatio: 0.1, yRatio: -0.16 },
          { xRatio: 0.22, yRatio: -0.21 },
        ],
        [
          { xRatio: 0.13, yRatio: 0.12 },
          { xRatio: 0.07, yRatio: 0.28 },
          { xRatio: 0.13, yRatio: 0.4 },
        ],
      ],
    },
    {
      subtlePaths: [
        [
          { xRatio: 0.32, yRatio: -0.39 },
          { xRatio: 0.25, yRatio: -0.27 },
          { xRatio: 0.28, yRatio: -0.14 },
          { xRatio: 0.16, yRatio: -0.05 },
        ],
        [
          { xRatio: 0.28, yRatio: -0.14 },
          { xRatio: 0.4, yRatio: -0.08 },
        ],
      ],
      severeExtensionPaths: [
        [
          { xRatio: 0.16, yRatio: -0.05 },
          { xRatio: 0.06, yRatio: 0.07 },
          { xRatio: 0.09, yRatio: 0.2 },
          { xRatio: -0.08, yRatio: 0.39 },
        ],
        [
          { xRatio: 0.06, yRatio: 0.07 },
          { xRatio: -0.08, yRatio: 0.01 },
          { xRatio: -0.2, yRatio: 0.08 },
        ],
        [
          { xRatio: 0.09, yRatio: 0.2 },
          { xRatio: 0.24, yRatio: 0.28 },
          { xRatio: 0.29, yRatio: 0.38 },
        ],
      ],
    },
  ] satisfies readonly MimicCrackPattern[],
} as const
