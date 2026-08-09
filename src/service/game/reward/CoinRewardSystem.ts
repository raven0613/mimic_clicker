import type { Container } from 'pixi.js'

import { coinRewardAnimationConfig } from '../../../configs/coinRewardAnimationConfig'
import type { RandomSource, Vector2 } from '../../../types/game'
import {
  createCoinRewardBatch,
  releaseCoinRewardBatch,
  updateCoinRewardBatch,
  type RuntimeCoinRewardBatch,
} from './coinRewardEffects'
import { CoinRewardSpritePool } from './coinRewardSpritePool'
import type { LoadedCoinRewardTextures } from './coinRewardTextures'

export class CoinRewardSystem {
  private readonly batches: RuntimeCoinRewardBatch[] = []
  private readonly spritePool: CoinRewardSpritePool
  private readonly host: HTMLElement
  private readonly textures: LoadedCoinRewardTextures
  private readonly random: RandomSource
  private readonly onRewardPresented: (
    reward: number,
    rewardEventId: number,
  ) => void
  private readonly onCollectionCompleted: (rewardEventId: number) => void
  private collectionTarget: Vector2 | null = null
  private activeCoinCount = 0

  public constructor(
    layer: Container,
    host: HTMLElement,
    textures: LoadedCoinRewardTextures,
    random: RandomSource,
    onRewardPresented: (reward: number, rewardEventId: number) => void,
    onCollectionCompleted: (rewardEventId: number) => void,
  ) {
    this.host = host
    this.textures = textures
    this.random = random
    this.onRewardPresented = onRewardPresented
    this.onCollectionCompleted = onCollectionCompleted
    this.spritePool = new CoinRewardSpritePool(layer, textures)
  }

  public setCollectionTargetFromViewport(
    target: Vector2 | null,
    fieldSize: Vector2,
  ): void {
    if (target === null) {
      this.collectionTarget = null
      return
    }

    const hostBounds = this.host.getBoundingClientRect()
    if (hostBounds.width <= 0 || hostBounds.height <= 0) return
    this.collectionTarget = {
      x:
        (target.x - hostBounds.left) *
        (fieldSize.x / hostBounds.width),
      y:
        (target.y - hostBounds.top) *
        (fieldSize.y / hostBounds.height),
    }
  }

  public addBurst(
    x: number,
    y: number,
    reward: number,
    fieldHeight: number,
    rewardEventId: number,
  ): void {
    const batch = createCoinRewardBatch({
      x,
      y,
      reward,
      rewardEventId,
      fieldHeight,
      availableCoinSlots:
        coinRewardAnimationConfig.burst.maximumConcurrentVisualCoins -
        this.activeCoinCount,
      random: this.random,
      textures: this.textures,
      spritePool: this.spritePool,
    })
    if (batch.coins.length === 0) {
      this.onRewardPresented(reward, rewardEventId)
      this.onCollectionCompleted(rewardEventId)
      return
    }

    this.activeCoinCount += batch.coins.length
    this.batches.push(batch)
  }

  public update(deltaMs: number): void {
    for (let index = this.batches.length - 1; index >= 0; index -= 1) {
      const batch = this.batches[index]
      const previousCoinCount = batch.coins.length
      const shouldPresentReward = updateCoinRewardBatch(
        batch,
        deltaMs,
        this.collectionTarget,
        this.textures,
        this.spritePool,
      )
      this.activeCoinCount -= previousCoinCount - batch.coins.length
      if (shouldPresentReward) {
        this.onRewardPresented(batch.reward, batch.rewardEventId)
      }
      if (batch.coins.length === 0) {
        this.onCollectionCompleted(batch.rewardEventId)
        this.batches.splice(index, 1)
      }
    }
  }

  public clear(): void {
    for (const batch of this.batches) {
      releaseCoinRewardBatch(batch, this.spritePool)
    }
    this.batches.length = 0
    this.activeCoinCount = 0
  }

  public destroy(): void {
    this.clear()
    this.spritePool.destroy()
  }
}
