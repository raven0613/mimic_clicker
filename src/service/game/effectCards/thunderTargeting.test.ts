import { describe, expect, it } from 'vitest'

import { effectCardConfig } from '../../../configs/effectCardConfig'
import { spawnConfig } from '../../../configs/spawnConfig'
import {
  collectThunderHitTargets,
  isEligibleThunderTarget,
  selectThunderTarget,
  type ThunderTarget,
} from './thunderTargeting'

function createTarget(
  id: string,
  x: number,
  y: number,
  overrides: Partial<ThunderTarget> = {},
): ThunderTarget {
  return {
    id,
    role: 'regular',
    health: 1,
    logicalX: x,
    logicalY: y,
    jackpotPhase: null,
    ...overrides,
  }
}

describe('thunder target selection', () => {
  it('accepts combat mimics and only a chasing revealed Jackpot', () => {
    expect(isEligibleThunderTarget(createTarget('regular', 0, 0))).toBe(true)
    expect(
      isEligibleThunderTarget(
        createTarget('disguise', 0, 0, { role: 'jackpotDisguise' }),
      ),
    ).toBe(true)
    expect(
      isEligibleThunderTarget(
        createTarget('chasing', 0, 0, {
          role: 'jackpot',
          jackpotPhase: 'chasing',
        }),
      ),
    ).toBe(true)
    expect(
      isEligibleThunderTarget(
        createTarget('escaping', 0, 0, {
          role: 'jackpot',
          jackpotPhase: 'escaping',
        }),
      ),
    ).toBe(false)
    expect(
      isEligibleThunderTarget(createTarget('dead', 0, 0, { health: 0 })),
    ).toBe(false)
  })

  it('prefers targets that have not already been selected', () => {
    const first = createTarget('first', 0, 0)
    const second = createTarget('second', 0, 0)

    expect(selectThunderTarget([first, second], new Set([first]), () => 0)).toBe(
      second,
    )
  })

  it('returns every eligible mimic overlapping one strike exactly once', () => {
    const width = effectCardConfig.thunder.spriteSheet.frameWidthPixels
    const selected = createTarget('selected', 100, 200)
    const overlapping = createTarget('overlapping', 100 + width / 2, 200)
    const farAway = createTarget('far', 100 + width * 4, 200)
    const untargetable = createTarget('untargetable', 100, 200, { health: 0 })

    expect(
      collectThunderHitTargets(
        [selected, overlapping, selected, farAway, untargetable],
        selected,
      ).map((target) => target.id),
    ).toEqual(['selected', 'overlapping'])
  })

  it('limits collateral damage to a square around the bottom impact point', () => {
    const impactSize =
      effectCardConfig.thunder.spriteSheet.frameWidthPixels
    const maximumCenterDistance =
      impactSize / 2 + spawnConfig.cardHeightPixels / 2
    const selected = createTarget('selected', 100, 200)
    const boundary = createTarget(
      'boundary',
      selected.logicalX,
      selected.logicalY + maximumCenterDistance,
    )
    const belowSquare = createTarget(
      'below-square',
      selected.logicalX,
      selected.logicalY + maximumCenterDistance + 1,
    )

    expect(
      collectThunderHitTargets(
        [selected, boundary, belowSquare],
        selected,
      ).map((target) => target.id),
    ).toEqual(['selected', 'boundary'])
  })
})
