import { coinRewardAnimationConfig } from '../../../configs/coinRewardAnimationConfig'
import type { RandomSource } from '../../../types/game'
import type { CoinRewardMotion } from './coinRewardMotion'
import {
  createRewardBurstMotion,
  randomBetween,
  randomIntegerInclusive,
} from './rewardBurstMotion'

interface CreateCoinRewardMotionInput {
  x: number
  y: number
  fieldHeight: number
  coinIndex: number
  random: RandomSource
}

export function createCoinRewardMotion(
  input: CreateCoinRewardMotionInput,
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
  const x = input.x +
    randomBetween(-burst.spawnJitterPixels, burst.spawnJitterPixels, input.random)
  const y = input.y +
    randomBetween(-burst.spawnJitterPixels, burst.spawnJitterPixels, input.random)
  const requestedGroundY =
    input.y +
    randomBetween(
      landing.minimumOffsetPixels,
      landing.maximumOffsetPixels,
      input.random,
    )
  const maximumGroundY =
    input.fieldHeight - landing.bottomSafeMarginPixels
  const bounceCount = randomIntegerInclusive(
    landing.minimumBounceCount,
    landing.maximumBounceCount,
    input.random,
  )
  const bounceVelocityRetention = randomBetween(
    landing.minimumVelocityRetention,
    landing.maximumVelocityRetention,
    input.random,
  )
  const flipElapsedMs =
    input.random() *
    (1_000 / coinRewardAnimationConfig.sprite.flipFramesPerSecond) *
    coinRewardAnimationConfig.spriteSheet.frameCount
  const restDurationMs =
    randomBetween(
      landing.minimumRestDurationMs,
      landing.maximumRestDurationMs,
      input.random,
    ) +
    input.coinIndex * collection.staggerPerCoinMs
  const collectionDurationMs = randomBetween(
    collection.minimumDurationMs,
    collection.maximumDurationMs,
    input.random,
  )
  const collectionArcHeightPixels = randomBetween(
    collection.minimumArcHeightPixels,
    collection.maximumArcHeightPixels,
    input.random,
  )
  const burstMotion = createRewardBurstMotion({
    x,
    y,
    launchAngleRadians: launchAngle,
    launchSpeedPixelsPerSecond: launchSpeed,
    groundY: Math.max(input.y, Math.min(maximumGroundY, requestedGroundY)),
    bounceCount,
    bounceVelocityRetention,
    horizontalVelocityRetention: landing.horizontalVelocityRetention,
    gravityPixelsPerSecondSquared: burst.gravityPixelsPerSecondSquared,
  })

  return {
    ...burstMotion,
    flipElapsedMs,
    restDurationMs,
    collectionStartX: 0,
    collectionStartY: 0,
    collectionDurationMs,
    collectionArcHeightPixels,
  }
}
