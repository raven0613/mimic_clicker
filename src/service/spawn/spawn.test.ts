import { describe, expect, it } from 'vitest'

import { mimicConfigs } from '../../configs/mimicConfigs'
import { spawnConfig } from '../../configs/spawnConfig'
import { createSeededRandom } from '../simulation/createSeededRandom'
import {
  calculateOverlapRatio,
  createFieldFillSpawnArea,
  selectSpawnPositionsUntilFull,
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
        minimumY: 50,
        maximumY: 50,
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
        minimumY: 50,
        maximumY: 50,
        occupiedBounds: [{ x: 40, y: 50, width: 420, height: 220 }],
      },
      () => 0.5,
    )

    expect(selected).toBeNull()
  })

  it('selects both axes continuously inside a rectangular spawn area', () => {
    const minimumY = spawnConfig.cardHeightPixels / 2
    const maximumY = minimumY + spawnConfig.cardHeightPixels
    const randomValues = [0.25, 0.75]
    let randomIndex = 0

    const selected = selectSpawnPosition(
      {
        fieldWidth:
          spawnConfig.horizontalSafeMarginPixels * 2 +
          spawnConfig.cardWidthPixels * 3,
        cardWidth: spawnConfig.cardWidthPixels,
        cardHeight: spawnConfig.cardHeightPixels,
        minimumY,
        maximumY,
        occupiedBounds: [],
      },
      () => randomValues[randomIndex++] ?? 0.5,
    )

    expect(selected).toEqual({
      x:
        spawnConfig.horizontalSafeMarginPixels +
        0.25 * spawnConfig.cardWidthPixels * 2,
      y: minimumY + 0.75 * (maximumY - minimumY),
    })
  })

  it('excludes the configured bottom zone from the shared field-fill area', () => {
    const fieldHeight =
      spawnConfig.fieldFillBottomNoSpawnHeightPixels +
      spawnConfig.cardHeightPixels * 3

    expect(createFieldFillSpawnArea(fieldHeight)).toEqual({
      minimumY: 0,
      maximumY:
        fieldHeight -
        spawnConfig.fieldFillBottomNoSpawnHeightPixels -
        spawnConfig.cardHeightPixels,
    })
  })

  it('naturally stops initial filling when no further position is valid', () => {
    const placements = selectSpawnPositionsUntilFull(
      {
        fieldWidth:
          spawnConfig.horizontalSafeMarginPixels * 2 +
          spawnConfig.cardWidthPixels,
        cardWidth: spawnConfig.cardWidthPixels,
        cardHeight: spawnConfig.cardHeightPixels,
        minimumY: 0,
        maximumY: 0,
        occupiedBounds: [],
        maximumPositionCount: spawnConfig.maximumConcurrentMimics,
      },
      () => 0.5,
    )

    expect(placements).toHaveLength(1)
  })

  it('returns no initial placements when the field is too short for a card', () => {
    const area = createFieldFillSpawnArea(
      spawnConfig.fieldFillBottomNoSpawnHeightPixels +
        spawnConfig.cardHeightPixels -
        1,
    )

    expect(
      selectSpawnPositionsUntilFull(
        {
          fieldWidth:
            spawnConfig.horizontalSafeMarginPixels * 2 +
            spawnConfig.cardWidthPixels,
          cardWidth: spawnConfig.cardWidthPixels,
          cardHeight: spawnConfig.cardHeightPixels,
          ...area,
          occupiedBounds: [],
          maximumPositionCount: spawnConfig.maximumConcurrentMimics,
        },
        () => 0.5,
      ),
    ).toEqual([])
  })
})
