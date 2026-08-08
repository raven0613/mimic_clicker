import { coinRewardAnimationConfig } from '../../../configs/coinRewardAnimationConfig'

export interface CoinFrameRectangle {
  x: number
  y: number
  width: number
  height: number
}

export function createCoinFlipFrameRectangles(
  sourceWidth: number,
  sourceHeight: number,
): CoinFrameRectangle[] {
  const sheet = coinRewardAnimationConfig.spriteSheet
  if (
    sourceWidth !== sheet.sourceWidthPixels ||
    sourceHeight !== sheet.sourceHeightPixels
  ) {
    throw new Error(
      `Invalid coin/gold_coin_flip dimensions: expected ${sheet.sourceWidthPixels}x${sheet.sourceHeightPixels}, received ${sourceWidth}x${sourceHeight}`,
    )
  }

  return Array.from({ length: sheet.frameCount }, (_, frameIndex) => ({
    x: frameIndex * sheet.frameWidthPixels,
    y: 0,
    width: sheet.frameWidthPixels,
    height: sheet.frameHeightPixels,
  }))
}
