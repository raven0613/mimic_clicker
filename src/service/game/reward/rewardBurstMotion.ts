import type { RandomSource } from '../../../types/game'

export type RewardBurstPhase =
  | 'airborne'
  | 'resting'
  | 'collecting'
  | 'completed'

export interface RewardBurstMotion {
  phase: RewardBurstPhase
  x: number
  y: number
  velocityX: number
  velocityY: number
  groundY: number
  remainingBounces: number
  bounceVelocityRetention: number
  horizontalVelocityRetention: number
  gravityPixelsPerSecondSquared: number
  phaseElapsedMs: number
}

interface CreateRewardBurstMotionInput {
  x: number
  y: number
  launchAngleRadians: number
  launchSpeedPixelsPerSecond: number
  groundY: number
  bounceCount: number
  bounceVelocityRetention: number
  horizontalVelocityRetention: number
  gravityPixelsPerSecondSquared: number
}

export function createRewardBurstMotion(
  input: CreateRewardBurstMotionInput,
): RewardBurstMotion {
  return {
    phase: 'airborne',
    x: input.x,
    y: input.y,
    velocityX:
      Math.cos(input.launchAngleRadians) * input.launchSpeedPixelsPerSecond,
    velocityY:
      Math.sin(input.launchAngleRadians) * input.launchSpeedPixelsPerSecond,
    groundY: input.groundY,
    remainingBounces: input.bounceCount,
    bounceVelocityRetention: input.bounceVelocityRetention,
    horizontalVelocityRetention: input.horizontalVelocityRetention,
    gravityPixelsPerSecondSquared: input.gravityPixelsPerSecondSquared,
    phaseElapsedMs: 0,
  }
}

export function advanceRewardBurstMotion(
  motion: RewardBurstMotion,
  deltaMs: number,
): void {
  if (motion.phase !== 'airborne') return

  const deltaSeconds = deltaMs / 1_000
  motion.velocityY += motion.gravityPixelsPerSecondSquared * deltaSeconds
  motion.x += motion.velocityX * deltaSeconds
  motion.y += motion.velocityY * deltaSeconds

  if (motion.y < motion.groundY || motion.velocityY <= 0) return

  motion.y = motion.groundY
  motion.remainingBounces -= 1
  if (motion.remainingBounces <= 0) {
    motion.remainingBounces = 0
    motion.velocityX = 0
    motion.velocityY = 0
    motion.phase = 'resting'
    motion.phaseElapsedMs = 0
    return
  }

  motion.velocityX *= motion.horizontalVelocityRetention
  motion.velocityY = -motion.velocityY * motion.bounceVelocityRetention
}

export function randomBetween(
  minimum: number,
  maximum: number,
  random: RandomSource,
): number {
  return minimum + (maximum - minimum) * random()
}

export function randomIntegerInclusive(
  minimum: number,
  maximum: number,
  random: RandomSource,
): number {
  return minimum + Math.floor(random() * (maximum - minimum + 1))
}
