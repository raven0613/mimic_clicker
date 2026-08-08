import { describe, expect, it } from 'vitest'

import { animationConfig } from '../../../configs/animationConfig'
import { calculateSpriteDisplaySize } from './spriteDisplaySize'

describe('sprite display size', () => {
  it('scales both frame dimensions without changing the source frame', () => {
    const config = animationConfig.manualHitEffect

    expect(
      calculateSpriteDisplaySize(
        config.spriteSheet.frameWidthPixels,
        config.spriteSheet.frameHeightPixels,
        config.displayScale,
      ),
    ).toEqual({
      width: config.spriteSheet.frameWidthPixels * config.displayScale,
      height: config.spriteSheet.frameHeightPixels * config.displayScale,
    })
  })

  it('rejects a non-positive display scale', () => {
    expect(() => calculateSpriteDisplaySize(100, 50, 0)).toThrow(
      'Display scale must be greater than zero',
    )
  })
})
