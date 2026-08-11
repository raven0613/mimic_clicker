import { describe, expect, it } from 'vitest'

import { animationConfig } from '../../../configs/animationConfig'
import { effectCardConfig } from '../../../configs/effectCardConfig'
import {
  advanceOneShotAnimation,
  getLoopingFrameIndex,
} from './spriteSheetAnimation'

describe('sprite-sheet animation timing', () => {
  it('shows every configured frame and completes exactly at total duration', () => {
    const { animationDurationMs: durationMs, spriteSheet } =
      animationConfig.weaponHitEffect
    const frameCount = spriteSheet.frameCount

    expect(advanceOneShotAnimation(0, 0, durationMs, frameCount)).toEqual({
      elapsedMs: 0,
      frameIndex: 0,
      completed: false,
    })
    expect(
      advanceOneShotAnimation(0, durationMs - 1, durationMs, frameCount),
    ).toEqual({
      elapsedMs: durationMs - 1,
      frameIndex: frameCount - 1,
      completed: false,
    })
    expect(advanceOneShotAnimation(0, durationMs, durationMs, frameCount)).toEqual({
      elapsedMs: durationMs,
      frameIndex: frameCount - 1,
      completed: true,
    })
  })

  it('loops independently from movement time', () => {
    const frameCount = effectCardConfig.meteorite.spriteSheet.frameCount
    const cycleDurationMs = effectCardConfig.meteorite.animationCycleDurationMs

    expect(getLoopingFrameIndex(0, cycleDurationMs, frameCount)).toBe(0)
    expect(getLoopingFrameIndex(cycleDurationMs - 1, cycleDurationMs, frameCount)).toBe(
      frameCount - 1,
    )
    expect(getLoopingFrameIndex(cycleDurationMs, cycleDurationMs, frameCount)).toBe(0)
  })
})
