import { describe, expect, it } from 'vitest'

import { coinRewardAnimationConfig } from '../../../configs/coinRewardAnimationConfig'
import { createCoinFlipFrameRectangles } from './coinRewardFrameLayout'

describe('coin reward texture slicing', () => {
  it('creates every configured frame from the horizontal strip', () => {
    const frames = createCoinFlipFrameRectangles(
      coinRewardAnimationConfig.spriteSheet.sourceWidthPixels,
      coinRewardAnimationConfig.spriteSheet.sourceHeightPixels,
    )

    expect(frames).toHaveLength(
      coinRewardAnimationConfig.spriteSheet.frameCount,
    )
    const lastFrame = frames.at(-1)
    expect(lastFrame && lastFrame.x + lastFrame.width).toBe(
      coinRewardAnimationConfig.spriteSheet.sourceWidthPixels,
    )
    for (const frame of frames) {
      expect(frame.width).toBe(
        coinRewardAnimationConfig.spriteSheet.frameWidthPixels,
      )
      expect(frame.height).toBe(
        coinRewardAnimationConfig.spriteSheet.frameHeightPixels,
      )
    }
  })

  it('rejects a strip whose dimensions do not match the configured asset', () => {
    expect(() =>
      createCoinFlipFrameRectangles(
        coinRewardAnimationConfig.spriteSheet.sourceWidthPixels - 1,
        coinRewardAnimationConfig.spriteSheet.sourceHeightPixels,
      ),
    ).toThrow(/gold_coin_flip/)
  })
})
