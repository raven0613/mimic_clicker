import { Rectangle, Texture } from 'pixi.js'

import {
  createHorizontalSpriteSheetFrameRectangles,
  type HorizontalSpriteSheetLayout,
} from './horizontalSpriteSheet'

export function createHorizontalSpriteSheetFrames(
  stripTexture: Texture,
  layout: HorizontalSpriteSheetLayout,
): Texture[] {
  return createHorizontalSpriteSheetFrameRectangles(
    stripTexture.width,
    stripTexture.height,
    layout,
  ).map(
    ({ x, y, width, height }) =>
      new Texture({
        source: stripTexture.source,
        frame: new Rectangle(x, y, width, height),
      }),
  )
}

export function destroySpriteSheetFrameTextures(frames: Texture[]): void {
  for (const frame of frames) frame.destroy(false)
}
