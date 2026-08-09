import { coinRewardAnimationConfig } from '../../../configs/coinRewardAnimationConfig'
import type { Vector2 } from '../../../types/game'
import {
  advanceRewardBurstMotion,
  type RewardBurstMotion,
} from './rewardBurstMotion'

export type CoinRewardPhase =
  | 'airborne'
  | 'resting'
  | 'collecting'
  | 'completed'

export interface CoinRewardMotion extends RewardBurstMotion {
  phase: CoinRewardPhase
  flipElapsedMs: number
  restDurationMs: number
  collectionStartX: number
  collectionStartY: number
  collectionDurationMs: number
  collectionArcHeightPixels: number
}

export function calculateVisualCoinCount(reward: number): number {
  if (reward <= 0) return 0

  const additionalCoins = Math.ceil(
    reward /
      coinRewardAnimationConfig.burst.rewardPerAdditionalVisualCoin,
  )
  return Math.min(
    coinRewardAnimationConfig.burst.maximumVisualCoinCount,
    coinRewardAnimationConfig.burst.baseVisualCoinCount + additionalCoins,
  )
}

export function calculateCoinFlipFrameIndex(
  flipElapsedMs: number,
): number {
  const elapsedFrames = Math.floor(
    (flipElapsedMs / 1_000) *
      coinRewardAnimationConfig.sprite.flipFramesPerSecond,
  )
  return elapsedFrames % coinRewardAnimationConfig.spriteSheet.frameCount
}

function updateAirborneMotion(motion: CoinRewardMotion, deltaMs: number): void {
  motion.flipElapsedMs += deltaMs
  advanceRewardBurstMotion(motion, deltaMs)
}

function updateRestingMotion(
  motion: CoinRewardMotion,
  deltaMs: number,
  collectionTarget: Vector2 | null,
): void {
  motion.phaseElapsedMs += deltaMs
  if (
    motion.phaseElapsedMs < motion.restDurationMs ||
    collectionTarget === null
  ) {
    return
  }

  motion.phase = 'collecting'
  motion.phaseElapsedMs = 0
  motion.collectionStartX = motion.x
  motion.collectionStartY = motion.y
}

function updateCollectingMotion(
  motion: CoinRewardMotion,
  deltaMs: number,
  collectionTarget: Vector2 | null,
): void {
  if (collectionTarget === null) return

  motion.phaseElapsedMs += deltaMs
  const progress = Math.min(
    1,
    motion.phaseElapsedMs / motion.collectionDurationMs,
  )
  const easedProgress = progress * progress
  const arcOffset =
    Math.sin(progress * Math.PI) * motion.collectionArcHeightPixels
  motion.x =
    motion.collectionStartX +
    (collectionTarget.x - motion.collectionStartX) * easedProgress
  motion.y =
    motion.collectionStartY +
    (collectionTarget.y - motion.collectionStartY) * easedProgress -
    arcOffset

  if (progress < 1) return

  motion.x = collectionTarget.x
  motion.y = collectionTarget.y
  motion.phase = 'completed'
}

export function advanceCoinRewardMotion(
  motion: CoinRewardMotion,
  deltaMs: number,
  collectionTarget: Vector2 | null,
): void {
  if (motion.phase === 'airborne') {
    updateAirborneMotion(motion, deltaMs)
  } else if (motion.phase === 'resting') {
    updateRestingMotion(motion, deltaMs, collectionTarget)
  } else if (motion.phase === 'collecting') {
    updateCollectingMotion(motion, deltaMs, collectionTarget)
  }
}
