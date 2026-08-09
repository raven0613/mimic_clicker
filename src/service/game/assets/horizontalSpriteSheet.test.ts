import { describe, expect, it } from 'vitest'

import { coinRewardAnimationConfig } from '../../../configs/coinRewardAnimationConfig'
import { animationConfig } from '../../../configs/animationConfig'
import { effectCardConfig } from '../../../configs/effectCardConfig'
import { createHorizontalSpriteSheetFrameRectangles } from './horizontalSpriteSheet'

describe('horizontal sprite sheet slicing', () => {
  it.each([
    ['coin reward', coinRewardAnimationConfig.spriteSheet],
    ['manual hit', animationConfig.manualHitEffect.spriteSheet],
    ['thunder', effectCardConfig.thunder.spriteSheet],
    ['meteorite', effectCardConfig.meteorite.spriteSheet],
    ['explosion', effectCardConfig.meteorite.explosionSpriteSheet],
    ['tornado start', effectCardConfig.tornado.spriteSheets.start],
    ['tornado run', effectCardConfig.tornado.spriteSheets.run],
    ['tornado end', effectCardConfig.tornado.spriteSheets.end],
  ])('creates every configured frame for %s', (_name, sheet) => {
    const frames = createHorizontalSpriteSheetFrameRectangles(
      sheet.sourceWidthPixels,
      sheet.sourceHeightPixels,
      sheet,
    )

    expect(frames).toHaveLength(sheet.frameCount)
    expect(frames.at(-1)!.x + frames.at(-1)!.width).toBe(
      sheet.sourceWidthPixels,
    )
    expect(frames.every((frame) => frame.y === 0)).toBe(true)
  })

  it('rejects dimensions that do not match the configured asset', () => {
    const sheet = effectCardConfig.thunder.spriteSheet

    expect(() =>
      createHorizontalSpriteSheetFrameRectangles(
        sheet.sourceWidthPixels - 1,
        sheet.sourceHeightPixels,
        sheet,
      ),
    ).toThrow(/effects\/thunder.*expected.*received/i)
  })
})
