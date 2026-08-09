import { Color, Container } from 'pixi.js'

import { animationConfig } from '../../../configs/animationConfig'
import type { Vector2 } from '../../../types/game'
import { destroySpriteSheetFrameTextures } from '../assets/horizontalSpriteSheetTextures'
import type { LoadedCombatEffectTextures } from '../assets/runtimeAssets'
import { OneShotSpriteEffectSystem } from './OneShotSpriteEffectSystem'
import { calculateSpriteDisplaySize } from './spriteDisplaySize'

export class HitEffectSystem {
  private readonly layer = new Container({ eventMode: 'none' })
  private readonly player = new OneShotSpriteEffectSystem(this.layer)
  private readonly textures: LoadedCombatEffectTextures

  public constructor(stage: Container, textures: LoadedCombatEffectTextures) {
    this.textures = textures
    stage.addChild(this.layer)
  }

  public add(position: Vector2, tintColor?: string): void {
    const config = animationConfig.manualHitEffect
    const displaySize = calculateSpriteDisplaySize(
      config.spriteSheet.frameWidthPixels,
      config.spriteSheet.frameHeightPixels,
      config.displayScale,
    )
    this.player.add({
      textures: this.textures.hitFrames,
      durationMs: config.animationDurationMs,
      position,
      width: displaySize.width,
      height: displaySize.height,
      anchor: { x: 0.5, y: 0.5 },
      tint:
        tintColor === undefined
          ? undefined
          : Color.shared.setValue(tintColor).toNumber(),
    })
  }

  public update(deltaMs: number): void {
    this.player.update(deltaMs)
  }

  public clear(): void {
    this.player.clear()
  }

  public destroy(): void {
    this.clear()
    this.layer.removeFromParent()
    this.layer.destroy({ children: true })
    destroySpriteSheetFrameTextures(this.textures.hitFrames)
  }
}
