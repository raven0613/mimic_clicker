import { describe, expect, it } from 'vitest'

import { clearRefillConfig } from '../../../configs/clearRefillConfig'
import {
  calculateRefillSpawnCount,
  calculateVisibleIntersectionRatio,
  isEffectiveClearRefillTarget,
} from './clearRefillTargets'

const fieldBounds = { x: 0, y: 0, width: 1_000, height: 700 }
const fullyVisibleBounds = { x: 100, y: 100, width: 100, height: 100 }

describe('clear-refill targets', () => {
  it('keeps the refill target above its trigger threshold', () => {
    expect(clearRefillConfig.targetEffectiveCount).toBeGreaterThan(
      clearRefillConfig.triggerMaximumEffectiveTargetCount,
    )
  })

  it('calculates only the number needed to reach the configured target', () => {
    expect(
      calculateRefillSpawnCount(
        clearRefillConfig.triggerMaximumEffectiveTargetCount,
      ),
    ).toBe(
      clearRefillConfig.targetEffectiveCount -
        clearRefillConfig.triggerMaximumEffectiveTargetCount,
    )
    expect(
      calculateRefillSpawnCount(clearRefillConfig.targetEffectiveCount),
    ).toBe(0)
  })

  it('calculates the card area intersecting the playable field', () => {
    expect(
      calculateVisibleIntersectionRatio(
        { ...fullyVisibleBounds, y: -50 },
        fieldBounds,
      ),
    ).toBe(0.5)
  })

  it('ignores an entrance target below the configured visible ratio', () => {
    const visibleHeight =
      fullyVisibleBounds.height *
      (clearRefillConfig.minimumVisibleRatioForTarget / 2)

    expect(
      isEffectiveClearRefillTarget(
        {
          bounds: {
            ...fullyVisibleBounds,
            y: visibleHeight - fullyVisibleBounds.height,
          },
          health: 1,
          jackpotPhase: null,
          role: 'regular',
        },
        fieldBounds,
      ),
    ).toBe(false)
  })

  it('counts regular, disguised Jackpot, and chasing Jackpot targets at the threshold', () => {
    const targetBounds = {
      ...fullyVisibleBounds,
      y:
        fullyVisibleBounds.height *
          clearRefillConfig.minimumVisibleRatioForTarget -
        fullyVisibleBounds.height,
    }

    for (const target of [
      { role: 'regular' as const, jackpotPhase: null },
      { role: 'jackpotDisguise' as const, jackpotPhase: null },
      { role: 'jackpot' as const, jackpotPhase: 'chasing' as const },
    ]) {
      expect(
        isEffectiveClearRefillTarget(
          { ...target, bounds: targetBounds, health: 1 },
          fieldBounds,
        ),
      ).toBe(true)
    }
  })

  it('ignores defeated and non-chasing Jackpot targets', () => {
    expect(
      isEffectiveClearRefillTarget(
        {
          bounds: fullyVisibleBounds,
          health: 0,
          jackpotPhase: null,
          role: 'regular',
        },
        fieldBounds,
      ),
    ).toBe(false)
    expect(
      isEffectiveClearRefillTarget(
        {
          bounds: fullyVisibleBounds,
          health: 1,
          jackpotPhase: 'stunned',
          role: 'jackpot',
        },
        fieldBounds,
      ),
    ).toBe(false)
  })
})
