import type { Texture } from 'pixi.js'

import { destroySpriteSheetFrameTextures } from '../assets/horizontalSpriteSheetTextures'

export interface LoadedCoinRewardTextures {
  flipFrames: Texture[]
  idle: Texture
}

export function destroyCoinFlipFrameTextures(
  textures: LoadedCoinRewardTextures,
): void {
  destroySpriteSheetFrameTextures(textures.flipFrames)
}
