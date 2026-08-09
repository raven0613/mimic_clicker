import { animationConfig } from '../../configs/animationConfig'
import { combatConfig } from '../../configs/combatConfig'
import type { RandomSource } from '../../types/game'
import {
  advanceEquipmentRewardMotion,
  createEquipmentRewardMotion,
  isEquipmentRewardMotionSettled,
} from '../game/equipment/equipmentRewardMotion'

interface SimulateEquipmentSettlingCompletionInput {
  x: number
  y: number
  fieldHeight: number
  random: RandomSource
}

export function simulateEquipmentSettlingCompletionMs(
  input: SimulateEquipmentSettlingCompletionInput,
): number {
  const motion = createEquipmentRewardMotion(input)
  let elapsedMs = 0

  while (!isEquipmentRewardMotionSettled(motion)) {
    advanceEquipmentRewardMotion(motion, combatConfig.maximumFrameDeltaMs)
    elapsedMs += combatConfig.maximumFrameDeltaMs
    if (elapsedMs > simulationLimitMs) {
      throw new Error(
        `Equipment reward motion did not settle within ${simulationLimitMs}ms`,
      )
    }
  }
  return elapsedMs
}

const simulationLimitMs =
  animationConfig.equipmentReward.landing.maximumRestDurationMs + 10_000
