import type { Sprite } from 'pixi.js'

import { coinRewardAnimationConfig } from '../../../configs/coinRewardAnimationConfig'
import type { RandomSource, Vector2 } from '../../../types/game'
import {
  advanceCoinRewardMotion,
  calculateCoinFlipFrameIndex,
  calculateVisualCoinCount,
  type CoinRewardMotion,
} from './coinRewardMotion'
import type { CoinRewardSpritePool } from './coinRewardSpritePool'
import type { LoadedCoinRewardTextures } from './coinRewardTextures'

interface RuntimeCoinReward {
  sprite: Sprite
  motion: CoinRewardMotion
  baseScale: number
}

export interface RuntimeCoinRewardBatch {
  coins: RuntimeCoinReward[]
  reward: number
  presentationTriggered: boolean
}

interface CreateCoinRewardBatchInput {
  x: number
  y: number
  reward: number
  fieldHeight: number
  availableCoinSlots: number
  random: RandomSource
  textures: LoadedCoinRewardTextures
  spritePool: CoinRewardSpritePool
}

function randomBetween(
  minimum: number,
  maximum: number,
  random: RandomSource,
): number {
  return minimum + (maximum - minimum) * random()
}

function randomIntegerInclusive(
  minimum: number,
  maximum: number,
  random: RandomSource,
): number {
  return minimum + Math.floor(random() * (maximum - minimum + 1))
}

function createCoinMotion(
  input: CreateCoinRewardBatchInput,
  coinIndex: number,
): CoinRewardMotion {
  const burst = coinRewardAnimationConfig.burst
  const landing = coinRewardAnimationConfig.landing
  const collection = coinRewardAnimationConfig.collection
  const launchAngle = randomBetween(
    burst.minimumLaunchAngleRadians,
    burst.maximumLaunchAngleRadians,
    input.random,
  )
  const launchSpeed = randomBetween(
    burst.minimumSpeedPixelsPerSecond,
    burst.maximumSpeedPixelsPerSecond,
    input.random,
  )
  const x = input.x + randomBetween(-burst.spawnJitterPixels, burst.spawnJitterPixels, input.random)
  const y = input.y + randomBetween(-burst.spawnJitterPixels, burst.spawnJitterPixels, input.random)
  const requestedGroundY =
    input.y +
    randomBetween(
      landing.minimumOffsetPixels,
      landing.maximumOffsetPixels,
      input.random,
    )
  const maximumGroundY =
    input.fieldHeight - landing.bottomSafeMarginPixels

  return {
    phase: 'airborne',
    x,
    y,
    velocityX: Math.cos(launchAngle) * launchSpeed,
    velocityY: Math.sin(launchAngle) * launchSpeed,
    groundY: Math.max(input.y, Math.min(maximumGroundY, requestedGroundY)),
    remainingBounces: randomIntegerInclusive(
      landing.minimumBounceCount,
      landing.maximumBounceCount,
      input.random,
    ),
    bounceVelocityRetention: randomBetween(
      landing.minimumVelocityRetention,
      landing.maximumVelocityRetention,
      input.random,
    ),
    phaseElapsedMs: 0,
    flipElapsedMs:
      input.random() *
      (1_000 / coinRewardAnimationConfig.sprite.flipFramesPerSecond) *
      coinRewardAnimationConfig.spriteSheet.frameCount,
    restDurationMs:
      randomBetween(
        landing.minimumRestDurationMs,
        landing.maximumRestDurationMs,
        input.random,
      ) +
      coinIndex * collection.staggerPerCoinMs,
    collectionStartX: 0,
    collectionStartY: 0,
    collectionDurationMs: randomBetween(
      collection.minimumDurationMs,
      collection.maximumDurationMs,
      input.random,
    ),
    collectionArcHeightPixels: randomBetween(
      collection.minimumArcHeightPixels,
      collection.maximumArcHeightPixels,
      input.random,
    ),
  }
}

export function createCoinRewardBatch(
  input: CreateCoinRewardBatchInput,
): RuntimeCoinRewardBatch {
  const visualCoinCount = Math.min(
    calculateVisualCoinCount(input.reward),
    Math.max(0, input.availableCoinSlots),
  )
  const coins = Array.from({ length: visualCoinCount }, (_, coinIndex) => {
    const sprite = input.spritePool.acquire()
    const displaySize = randomBetween(
      coinRewardAnimationConfig.sprite.minimumDisplaySizePixels,
      coinRewardAnimationConfig.sprite.maximumDisplaySizePixels,
      input.random,
    )
    sprite.setSize(displaySize)
    const motion = createCoinMotion(input, coinIndex)
    sprite.position.set(motion.x, motion.y)

    return {
      sprite,
      motion,
      baseScale: sprite.scale.x,
    }
  })

  return {
    coins,
    reward: input.reward,
    presentationTriggered: false,
  }
}

function updateCoinSprite(
  coin: RuntimeCoinReward,
  textures: LoadedCoinRewardTextures,
): void {
  if (coin.sprite.destroyed) return

  const { motion, sprite } = coin
  sprite.position.set(motion.x, motion.y)
  if (motion.phase === 'airborne') {
    sprite.texture =
      textures.flipFrames[calculateCoinFlipFrameIndex(motion.flipElapsedMs)]
    sprite.scale.set(coin.baseScale)
    sprite.alpha = 1
  } else if (motion.phase === 'resting') {
    sprite.texture = textures.flipFrames.at(-1) ?? textures.flipFrames[0]
    sprite.scale.set(coin.baseScale)
    sprite.alpha = 1
  } else if (motion.phase === 'collecting') {
    sprite.texture = textures.idle
    const progress = Math.min(
      1,
      motion.phaseElapsedMs / motion.collectionDurationMs,
    )
    const scale =
      1 -
      progress *
        (1 - coinRewardAnimationConfig.collection.endingScale)
    sprite.scale.set(coin.baseScale * scale)
    const fadeStart = coinRewardAnimationConfig.collection.fadeStartProgress
    sprite.alpha =
      progress <= fadeStart
        ? 1
        : 1 - (progress - fadeStart) / (1 - fadeStart)
  }
}

export function updateCoinRewardBatch(
  batch: RuntimeCoinRewardBatch,
  deltaMs: number,
  collectionTarget: Vector2 | null,
  textures: LoadedCoinRewardTextures,
  spritePool: CoinRewardSpritePool,
): boolean {
  let reachedCollectionTarget = false

  for (let index = batch.coins.length - 1; index >= 0; index -= 1) {
    const coin = batch.coins[index]
    if (coin.sprite.destroyed) {
      batch.coins.splice(index, 1)
      continue
    }

    const previousPhase = coin.motion.phase
    advanceCoinRewardMotion(coin.motion, deltaMs, collectionTarget)
    updateCoinSprite(coin, textures)
    if (previousPhase !== 'completed' && coin.motion.phase === 'completed') {
      reachedCollectionTarget = true
      spritePool.release(coin.sprite)
      batch.coins.splice(index, 1)
    }
  }

  if (reachedCollectionTarget && !batch.presentationTriggered) {
    batch.presentationTriggered = true
    return true
  }
  return false
}

export function releaseCoinRewardBatch(
  batch: RuntimeCoinRewardBatch,
  spritePool: CoinRewardSpritePool,
): void {
  for (const coin of batch.coins) spritePool.release(coin.sprite)
  batch.coins.length = 0
}
