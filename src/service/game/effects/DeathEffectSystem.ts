import { Container, type Texture } from 'pixi.js'

import type { RandomSource, Vector2 } from '../../../types/game'
import { CoinRewardSystem } from '../reward/CoinRewardSystem'
import {
  destroyCoinFlipFrameTextures,
  type LoadedCoinRewardTextures,
} from '../reward/coinRewardTextures'
import type { AnimatedEffect } from '../runtimeTypes'
import { createShatterEffects, updateAnimatedEffect } from './shatterEffects'

export interface AddDeathEffectInput {
  texture: Texture
  x: number
  y: number
  width: number
  height: number
  reward: number
  rewardEventId: number
  fieldHeight: number
}

export class DeathEffectSystem {
  private readonly shatterLayer = new Container({ eventMode: 'none' })
  private readonly coinLayer = new Container({ eventMode: 'none' })
  private readonly shatterEffects: AnimatedEffect[] = []
  private readonly coinRewardSystem: CoinRewardSystem
  private readonly coinTextures: LoadedCoinRewardTextures
  private readonly random: RandomSource

  public constructor(
    stage: Container,
    host: HTMLElement,
    coinTextures: LoadedCoinRewardTextures,
    random: RandomSource,
    onRewardPresented: (reward: number, rewardEventId: number) => void,
    onRewardCollectionCompleted: (rewardEventId: number) => void,
  ) {
    this.coinTextures = coinTextures
    this.random = random
    stage.addChild(this.shatterLayer, this.coinLayer)
    this.coinRewardSystem = new CoinRewardSystem(
      this.coinLayer,
      host,
      coinTextures,
      random,
      onRewardPresented,
      onRewardCollectionCompleted,
    )
  }

  public setRewardCollectionTarget(
    target: Vector2 | null,
    fieldSize: Vector2,
  ): void {
    this.coinRewardSystem.setCollectionTargetFromViewport(target, fieldSize)
  }

  public add(input: AddDeathEffectInput): void {
    this.coinRewardSystem.addBurst(
      input.x,
      input.y,
      input.reward,
      input.fieldHeight,
      input.rewardEventId,
    )
    const shatterEffects = createShatterEffects(
      input.texture,
      input.x,
      input.y,
      input.width,
      input.height,
      this.random,
    )
    for (const effect of shatterEffects) {
      this.shatterEffects.push(effect)
      this.shatterLayer.addChild(effect.container)
    }
  }

  public update(deltaMs: number): void {
    this.coinRewardSystem.update(deltaMs)
    for (let index = this.shatterEffects.length - 1; index >= 0; index -= 1) {
      const effect = this.shatterEffects[index]
      if (!updateAnimatedEffect(effect, deltaMs)) continue

      this.shatterEffects.splice(index, 1)
      effect.container.removeFromParent()
      effect.container.destroy({ children: true })
    }
  }

  public clear(): void {
    this.coinRewardSystem.clear()
    for (const effect of this.shatterEffects) {
      effect.container.removeFromParent()
      effect.container.destroy({ children: true })
    }
    this.shatterEffects.length = 0
  }

  public destroy(): void {
    this.clear()
    this.coinRewardSystem.destroy()
    destroyCoinFlipFrameTextures(this.coinTextures)
    this.shatterLayer.removeFromParent()
    this.coinLayer.removeFromParent()
    this.shatterLayer.destroy({ children: true })
    this.coinLayer.destroy({ children: true })
  }
}
