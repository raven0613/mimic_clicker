import { describe, expect, it } from 'vitest'

import { coinRewardAnimationConfig } from '../../../configs/coinRewardAnimationConfig'
import { combatConfig } from '../../../configs/combatConfig'
import { jackpotConfig } from '../../../configs/jackpotConfig'
import { mimicConfigs } from '../../../configs/mimicConfigs'
import {
  advanceCoinRewardMotion,
  calculateVisualCoinCount,
  type CoinRewardMotion,
} from './coinRewardMotion'

function createTestMotion(): CoinRewardMotion {
  return {
    phase: 'airborne',
    x: 0,
    y: 0,
    velocityX: coinRewardAnimationConfig.burst.minimumSpeedPixelsPerSecond,
    velocityY: 0,
    groundY: coinRewardAnimationConfig.landing.minimumOffsetPixels,
    remainingBounces: coinRewardAnimationConfig.landing.minimumBounceCount,
    bounceVelocityRetention:
      coinRewardAnimationConfig.landing.minimumVelocityRetention,
    phaseElapsedMs: 0,
    flipElapsedMs: 0,
    restDurationMs: coinRewardAnimationConfig.landing.minimumRestDurationMs,
    collectionStartX: 0,
    collectionStartY: 0,
    collectionDurationMs:
      coinRewardAnimationConfig.collection.minimumDurationMs,
    collectionArcHeightPixels:
      coinRewardAnimationConfig.collection.minimumArcHeightPixels,
  }
}

function advanceUntil(
  motion: CoinRewardMotion,
  phase: CoinRewardMotion['phase'],
  target: { x: number; y: number } | null,
): void {
  const maximumSteps = 1_000

  for (let step = 0; step < maximumSteps && motion.phase !== phase; step += 1) {
    advanceCoinRewardMotion(
      motion,
      combatConfig.maximumFrameDeltaMs,
      target,
    )
  }

  expect(motion.phase).toBe(phase)
}

describe('coin reward motion', () => {
  it('maps larger rewards to more visual coins without exceeding the cap', () => {
    const normalCount = calculateVisualCoinCount(mimicConfigs.normal.baseReward)
    const rareCount = calculateVisualCoinCount(mimicConfigs.rare2.baseReward)
    const jackpotReward =
      mimicConfigs.rare2.baseReward * jackpotConfig.rewardMultiplier
    const jackpotCount = calculateVisualCoinCount(jackpotReward)

    expect(rareCount).toBeGreaterThan(normalCount)
    expect(jackpotCount).toBeGreaterThan(rareCount)
    expect(jackpotCount).toBeLessThanOrEqual(
      coinRewardAnimationConfig.burst.maximumVisualCoinCount,
    )
  })

  it('settles after the configured number of ground bounces', () => {
    const motion = createTestMotion()

    advanceUntil(motion, 'resting', null)

    expect(motion.remainingBounces).toBe(0)
    expect(motion.y).toBe(motion.groundY)
  })

  it('waits on the ground until a collection target is available', () => {
    const motion = createTestMotion()
    advanceUntil(motion, 'resting', null)

    advanceCoinRewardMotion(
      motion,
      motion.restDurationMs + combatConfig.maximumFrameDeltaMs,
      null,
    )

    expect(motion.phase).toBe('resting')
  })

  it('finishes exactly at the collection target', () => {
    const motion = createTestMotion()
    const target = {
      x: coinRewardAnimationConfig.collection.minimumArcHeightPixels,
      y: -coinRewardAnimationConfig.collection.minimumArcHeightPixels,
    }
    advanceUntil(motion, 'resting', target)
    advanceUntil(motion, 'collecting', target)
    advanceUntil(motion, 'completed', target)

    expect(motion.x).toBe(target.x)
    expect(motion.y).toBe(target.y)
  })
})
