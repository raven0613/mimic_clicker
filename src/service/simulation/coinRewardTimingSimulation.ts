import { coinRewardAnimationConfig } from '../../configs/coinRewardAnimationConfig'
import { combatConfig } from '../../configs/combatConfig'
import type { RandomSource } from '../../types/game'
import {
  advanceCoinRewardMotion,
  calculateVisualCoinCount,
} from '../game/reward/coinRewardMotion'
import { createCoinRewardMotion } from '../game/reward/coinRewardMotionFactory'

interface SimulateCoinCollectionCompletionInput {
  reward: number
  x: number
  y: number
  fieldHeight: number
  random: RandomSource
}

export function simulateCoinCollectionCompletionMs(
  input: SimulateCoinCollectionCompletionInput,
): number {
  const motions = Array.from(
    { length: calculateVisualCoinCount(input.reward) },
    (_, coinIndex) => {
      consumeDisplaySizeRoll(input.random)
      return createCoinRewardMotion({
        x: input.x,
        y: input.y,
        fieldHeight: input.fieldHeight,
        coinIndex,
        random: input.random,
      })
    },
  )
  if (motions.length === 0) return 0

  let elapsedMs = 0
  const collectionTarget = { x: input.x, y: 0 }
  while (motions.some((motion) => motion.phase !== 'completed')) {
    for (const motion of motions) {
      advanceCoinRewardMotion(
        motion,
        combatConfig.maximumFrameDeltaMs,
        collectionTarget,
      )
    }
    elapsedMs += combatConfig.maximumFrameDeltaMs
    if (elapsedMs > coinRewardAnimationConfigSimulationLimitMs) {
      throw new Error(
        `Coin reward timing did not complete within ${coinRewardAnimationConfigSimulationLimitMs}ms`,
      )
    }
  }
  return elapsedMs
}

const coinRewardAnimationConfigSimulationLimitMs =
  coinRewardAnimationConfig.landing.maximumRestDurationMs +
  coinRewardAnimationConfig.collection.maximumDurationMs +
  10_000

function consumeDisplaySizeRoll(random: RandomSource): void {
  random()
}
