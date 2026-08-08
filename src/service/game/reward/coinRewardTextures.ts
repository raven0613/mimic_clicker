import { Assets, Rectangle, Texture } from 'pixi.js'

import goldCoinFlipImageUrl from '../../../assets/coin/gold_coin_flip.png'
import goldCoinIdleImageUrl from '../../../assets/coin/gold_coin_idle.png'
import { createCoinFlipFrameRectangles } from './coinRewardFrameLayout'

export interface LoadedCoinRewardTextures {
  flipFrames: Texture[]
  idle: Texture
}

export async function loadCoinRewardTextures(): Promise<LoadedCoinRewardTextures> {
  const [flipStrip, idle] = await Promise.all([
    Assets.load<Texture>(goldCoinFlipImageUrl),
    Assets.load<Texture>(goldCoinIdleImageUrl),
  ])
  const frameRectangles = createCoinFlipFrameRectangles(
    flipStrip.width,
    flipStrip.height,
  )
  const flipFrames = frameRectangles.map(({ x, y, width, height }) =>
    new Texture({
      source: flipStrip.source,
      frame: new Rectangle(x, y, width, height),
    }),
  )

  return { flipFrames, idle }
}

export function destroyCoinFlipFrameTextures(
  textures: LoadedCoinRewardTextures,
): void {
  for (const frame of textures.flipFrames) frame.destroy(false)
}
