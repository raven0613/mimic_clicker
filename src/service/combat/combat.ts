import { jackpotConfig } from '../../configs/jackpotConfig'
import type { Vector2 } from '../../types/game'

interface DamageResult {
  remainingHealth: number
  isDefeated: boolean
}

export interface JackpotLifecycle {
  phase: 'chasing' | 'stunned' | 'escaping' | 'exited'
  remainingChaseMs: number
  phaseElapsedMs: number
  lockedEscapeX: number | null
}

export function applyDamage(
  currentHealth: number,
  damage: number,
): DamageResult {
  const remainingHealth = Math.max(0, currentHealth - Math.max(0, damage))
  return {
    remainingHealth,
    isDefeated: remainingHealth === 0,
  }
}

export function reflectVelocity(
  velocity: Vector2,
  surfaceNormal: Vector2,
): Vector2 {
  const normalMagnitude = Math.hypot(surfaceNormal.x, surfaceNormal.y)
  if (normalMagnitude === 0) {
    throw new Error('Cannot reflect velocity against a zero-length normal')
  }

  const normalX = surfaceNormal.x / normalMagnitude
  const normalY = surfaceNormal.y / normalMagnitude
  const projection = velocity.x * normalX + velocity.y * normalY

  return {
    x: velocity.x - 2 * projection * normalX,
    y: velocity.y - 2 * projection * normalY,
  }
}

export function stabilizeJackpotVelocity(velocity: Vector2): Vector2 {
  const speed = Math.hypot(velocity.x, velocity.y)
  if (speed === 0) {
    throw new Error('Cannot stabilize a zero-length Jackpot velocity')
  }
  const minimumComponent =
    speed * jackpotConfig.minimumDirectionComponentRatio
  let x = velocity.x
  let y = velocity.y

  if (Math.abs(x) < minimumComponent) {
    x = (x < 0 ? -1 : 1) * minimumComponent
    y = (y < 0 ? -1 : 1) * Math.sqrt(speed * speed - x * x)
  } else if (Math.abs(y) < minimumComponent) {
    y = (y < 0 ? -1 : 1) * minimumComponent
    x = (x < 0 ? -1 : 1) * Math.sqrt(speed * speed - y * y)
  }
  return { x, y }
}

export function advanceJackpotLifecycle(
  lifecycle: JackpotLifecycle,
  deltaMs: number,
  currentX: number,
): JackpotLifecycle {
  if (lifecycle.phase === 'chasing') {
    const remainingChaseMs = Math.max(0, lifecycle.remainingChaseMs - deltaMs)
    if (remainingChaseMs === 0) {
      return {
        phase: 'stunned',
        remainingChaseMs: 0,
        phaseElapsedMs: 0,
        lockedEscapeX: currentX,
      }
    }
    return { ...lifecycle, remainingChaseMs }
  }

  if (lifecycle.phase === 'stunned') {
    const phaseElapsedMs = lifecycle.phaseElapsedMs + deltaMs
    if (phaseElapsedMs >= jackpotConfig.escapeStunDurationMs) {
      return { ...lifecycle, phase: 'escaping', phaseElapsedMs: 0 }
    }
    return { ...lifecycle, phaseElapsedMs }
  }

  return lifecycle
}
