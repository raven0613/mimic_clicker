import { animationConfig } from '../../../configs/animationConfig'
import type { RandomSource } from '../../../types/game'
import {
  advanceRewardBurstMotion,
  createRewardBurstMotion,
  randomBetween,
  randomIntegerInclusive,
  type RewardBurstMotion,
} from '../reward/rewardBurstMotion'

export interface EquipmentRewardMotion extends RewardBurstMotion {
  rotation: number
  rotationSpeedRadiansPerSecond: number
  restDurationMs: number
}

interface CreateEquipmentRewardMotionInput {
  x: number
  y: number
  fieldHeight: number
  random: RandomSource
}

export function createEquipmentRewardMotion(
  input: CreateEquipmentRewardMotionInput,
): EquipmentRewardMotion {
  const { burst, landing } = animationConfig.equipmentReward
  const launchAngleRadians = randomBetween(
    burst.minimumLaunchAngleRadians,
    burst.maximumLaunchAngleRadians,
    input.random,
  )
  const launchSpeedPixelsPerSecond = randomBetween(
    burst.minimumSpeedPixelsPerSecond,
    burst.maximumSpeedPixelsPerSecond,
    input.random,
  )
  const x = input.x + randomBetween(
    -burst.spawnJitterPixels,
    burst.spawnJitterPixels,
    input.random,
  )
  const y = input.y + randomBetween(
    -burst.spawnJitterPixels,
    burst.spawnJitterPixels,
    input.random,
  )
  const requestedGroundY = input.y + randomBetween(
    landing.minimumOffsetPixels,
    landing.maximumOffsetPixels,
    input.random,
  )
  const groundY = Math.max(
    input.y,
    Math.min(
      input.fieldHeight - landing.bottomSafeMarginPixels,
      requestedGroundY,
    ),
  )
  const burstMotion = createRewardBurstMotion({
    x,
    y,
    launchAngleRadians,
    launchSpeedPixelsPerSecond,
    groundY,
    bounceCount: randomIntegerInclusive(
      landing.minimumBounceCount,
      landing.maximumBounceCount,
      input.random,
    ),
    bounceVelocityRetention: randomBetween(
      landing.minimumVelocityRetention,
      landing.maximumVelocityRetention,
      input.random,
    ),
    horizontalVelocityRetention: landing.horizontalVelocityRetention,
    gravityPixelsPerSecondSquared: burst.gravityPixelsPerSecondSquared,
  })

  return {
    ...burstMotion,
    rotation: 0,
    rotationSpeedRadiansPerSecond: randomBetween(
      -burst.maximumRotationSpeedRadiansPerSecond,
      burst.maximumRotationSpeedRadiansPerSecond,
      input.random,
    ),
    restDurationMs: randomBetween(
      landing.minimumRestDurationMs,
      landing.maximumRestDurationMs,
      input.random,
    ),
  }
}

export function advanceEquipmentRewardMotion(
  motion: EquipmentRewardMotion,
  deltaMs: number,
): void {
  const wasAirborne = motion.phase === 'airborne'
  advanceRewardBurstMotion(motion, deltaMs)
  if (wasAirborne) {
    motion.rotation +=
      motion.rotationSpeedRadiansPerSecond * (deltaMs / 1_000)
    return
  }
  if (motion.phase === 'resting') motion.phaseElapsedMs += deltaMs
}

export function isEquipmentRewardMotionSettled(
  motion: EquipmentRewardMotion,
): boolean {
  return (
    motion.phase === 'resting' &&
    motion.phaseElapsedMs >= motion.restDurationMs
  )
}
