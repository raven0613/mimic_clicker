import { describe, expect, it } from 'vitest'

import { jackpotConfig } from '../../configs/jackpotConfig'
import { getInitialWeaponDefinition } from '../progression/weaponProgression'
import {
  applyDamage,
  advanceJackpotLifecycle,
  reflectVelocity,
  stabilizeJackpotVelocity,
} from './combat'

describe('combat rules', () => {
  it('derives defeat from remaining health without storing hit counts', () => {
    const firstHit = applyDamage(
      getInitialWeaponDefinition().baseDamage,
      getInitialWeaponDefinition().baseDamage,
    )

    expect(firstHit.remainingHealth).toBe(0)
    expect(firstHit.isDefeated).toBe(true)
  })

  it('reflects against a wall normal while preserving speed', () => {
    const velocity = { x: 120, y: 80 }
    const reflected = reflectVelocity(velocity, { x: -1, y: 0 })
    const speed = Math.hypot(velocity.x, velocity.y)

    expect(reflected.x).toBeLessThan(0)
    expect(reflected.y).toBeCloseTo(velocity.y)
    expect(Math.hypot(reflected.x, reflected.y)).toBeCloseTo(speed)
  })

  it('corrects a degenerate chase direction without changing its speed', () => {
    const velocity = { x: 0.001, y: jackpotConfig.chaseSpeedPixelsPerSecond }
    const stabilized = stabilizeJackpotVelocity(velocity)

    expect(Math.abs(stabilized.x)).toBeGreaterThan(
      jackpotConfig.chaseSpeedPixelsPerSecond *
        jackpotConfig.minimumDirectionComponentRatio *
        0.99,
    )
    expect(Math.hypot(stabilized.x, stabilized.y)).toBeCloseTo(
      Math.hypot(velocity.x, velocity.y),
    )
  })

  it('changes from chasing to stun and then a locked vertical escape', () => {
    const chasing = {
      phase: 'chasing' as const,
      remainingChaseMs: 1,
      phaseElapsedMs: 0,
      lockedEscapeX: null,
    }
    const stunned = advanceJackpotLifecycle(chasing, 1, 420)
    const escaping = advanceJackpotLifecycle(
      stunned,
      jackpotConfig.escapeStunDurationMs,
      999,
    )

    expect(stunned.phase).toBe('stunned')
    expect(stunned.lockedEscapeX).toBe(420)
    expect(escaping.phase).toBe('escaping')
    expect(escaping.lockedEscapeX).toBe(420)
  })
})
