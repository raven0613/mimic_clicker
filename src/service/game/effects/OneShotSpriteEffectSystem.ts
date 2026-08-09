import { AnimatedSprite, type Container, type Texture } from 'pixi.js'

import type { Vector2 } from '../../../types/game'
import { advanceOneShotAnimation } from './spriteSheetAnimation'

interface ActiveOneShotEffect {
  sprite: AnimatedSprite
  elapsedMs: number
  durationMs: number
}

interface AddOneShotEffectInput {
  textures: Texture[]
  durationMs: number
  position: Vector2
  width: number
  height: number
  anchor: Vector2
  rotationRadians?: number
  tint?: number
}

export class OneShotSpriteEffectSystem {
  private readonly parent: Container
  private readonly activeEffects: ActiveOneShotEffect[] = []

  public constructor(parent: Container) {
    this.parent = parent
  }

  public add(input: AddOneShotEffectInput): void {
    const sprite = new AnimatedSprite({
      textures: input.textures,
      autoUpdate: false,
      loop: false,
      anchor: input.anchor,
      eventMode: 'none',
      roundPixels: true,
    })
    sprite.setSize(input.width, input.height)
    sprite.position.set(Math.round(input.position.x), Math.round(input.position.y))
    sprite.rotation = input.rotationRadians ?? 0
    if (input.tint !== undefined) sprite.tint = input.tint
    sprite.gotoAndStop(0)
    this.activeEffects.push({ sprite, elapsedMs: 0, durationMs: input.durationMs })
    this.parent.addChild(sprite)
  }

  public update(deltaMs: number): void {
    for (let index = this.activeEffects.length - 1; index >= 0; index -= 1) {
      const effect = this.activeEffects[index]
      const progress = advanceOneShotAnimation(
        effect.elapsedMs,
        deltaMs,
        effect.durationMs,
        effect.sprite.textures.length,
      )
      effect.elapsedMs = progress.elapsedMs
      effect.sprite.gotoAndStop(progress.frameIndex)
      if (!progress.completed) continue

      this.activeEffects.splice(index, 1)
      destroyAnimatedSprite(effect.sprite)
    }
  }

  public clear(): void {
    for (const effect of this.activeEffects) destroyAnimatedSprite(effect.sprite)
    this.activeEffects.length = 0
  }
}

function destroyAnimatedSprite(sprite: AnimatedSprite): void {
  sprite.removeFromParent()
  sprite.destroy({ texture: false, textureSource: false })
}
