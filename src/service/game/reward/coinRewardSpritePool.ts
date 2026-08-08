import { Container, Sprite } from 'pixi.js'

import type { LoadedCoinRewardTextures } from './coinRewardTextures'

export class CoinRewardSpritePool {
  private readonly availableSprites: Sprite[] = []
  private readonly layer: Container
  private readonly textures: LoadedCoinRewardTextures

  public constructor(
    layer: Container,
    textures: LoadedCoinRewardTextures,
  ) {
    this.layer = layer
    this.textures = textures
  }

  public acquire(): Sprite {
    const sprite =
      this.availableSprites.pop() ??
      new Sprite({
        texture: this.textures.flipFrames[0],
        anchor: 0.5,
        eventMode: 'none',
      })
    if (!sprite.parent) this.layer.addChild(sprite)

    sprite.texture = this.textures.flipFrames[0]
    sprite.position.set(0, 0)
    sprite.scale.set(1)
    sprite.rotation = 0
    sprite.alpha = 1
    sprite.visible = true
    return sprite
  }

  public release(sprite: Sprite): void {
    if (sprite.destroyed) return
    sprite.visible = false
    sprite.alpha = 1
    this.availableSprites.push(sprite)
  }

  public destroy(): void {
    for (const child of this.layer.removeChildren()) {
      if (!child.destroyed) child.destroy()
    }
    this.availableSprites.length = 0
  }
}
