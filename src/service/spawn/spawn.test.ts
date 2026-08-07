import { describe, expect, it } from 'vitest'

import { mimicConfigs } from '../../configs/mimicConfigs'
import { createSeededRandom } from '../simulation/createSeededRandom'
import {
  calculateOverlapRatio,
  selectSpawnPosition,
  selectWeightedMimicId,
} from './spawn'

describe('spawn selection', () => {
  it('never selects a locked mimic', () => {
    const random = createSeededRandom(17)
    const results = Array.from({ length: 100 }, () =>
      selectWeightedMimicId(['normal'], random),
    )

    expect(new Set(results)).toEqual(new Set(['normal']))
  })

  it('selects every unlocked positive-weight mimic across a stable sample', () => {
    const random = createSeededRandom(91)
    const unlocked = ['normal', 'rare1', 'rare2'] as const
    const results = Array.from({ length: 2_000 }, () =>
      selectWeightedMimicId([...unlocked], random),
    )

    for (const mimicId of unlocked) {
      expect(mimicConfigs[mimicId].spawnWeight).toBeGreaterThan(0)
      expect(results).toContain(mimicId)
    }
  })

  it('chooses a continuous candidate with the least allowed overlap', () => {
    const candidates = [0.1, 0.9]
    let index = 0
    const selected = selectSpawnPosition(
      {
        fieldWidth: 1_000,
        cardWidth: 160,
        cardHeight: 220,
        spawnY: 50,
        occupiedBounds: [{ x: 80, y: 20, width: 160, height: 220 }],
      },
      () => candidates[index++] ?? candidates.at(-1)!,
    )

    expect(selected).not.toBeNull()
    expect(selected!.x).toBeGreaterThan(500)
    expect(
      calculateOverlapRatio(
        { ...selected!, width: 160, height: 220 },
        { x: 80, y: 20, width: 160, height: 220 },
      ),
    ).toBe(0)
  })

  it('delays spawning when every candidate overlaps too much', () => {
    const selected = selectSpawnPosition(
      {
        fieldWidth: 500,
        cardWidth: 420,
        cardHeight: 220,
        spawnY: 50,
        occupiedBounds: [{ x: 40, y: 50, width: 420, height: 220 }],
      },
      () => 0.5,
    )

    expect(selected).toBeNull()
  })
})
