import type { Container, Sprite, Texture } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../damage/mimicCrackVisual', () => ({
  updateMimicCrackVisual: vi.fn(),
}))

import { combatConfig } from '../../../configs/combatConfig'
import type { RuntimeMimicEntity } from '../runtimeTypes'
import { revealRuntimeJackpot } from './revealRuntimeJackpot'

function createDisguisedJackpot(): RuntimeMimicEntity {
  return {
    mimicId: 'normal',
    role: 'jackpotDisguise',
    container: { zIndex: 0 } as Container,
    sprite: { texture: null } as unknown as Sprite,
    flashSprite: { texture: null } as unknown as Sprite,
    health: 0,
    maximumHealth: 0,
    crackVisual: null,
    logicalX: 0,
    logicalY: 0,
    downwardSpeedPixelsPerSecond: 0,
    hitAnimationRemainingMs: 0,
    nextWeaponDamageAllowedAtMs:
      combatConfig.minimumWeaponDamageIntervalPerTargetMs,
    jackpotLifecycle: null,
    jackpotVelocity: { x: 0, y: 0 },
    attachedCardFan: null,
    effectCards: [],
  }
}

describe('runtime Jackpot reveal', () => {
  it('preserves the remaining weapon damage interval from its disguise', () => {
    const entity = createDisguisedJackpot()
    const nextAllowedAtMs = entity.nextWeaponDamageAllowedAtMs

    revealRuntimeJackpot(entity, {} as Texture, () => 0)

    expect(entity.nextWeaponDamageAllowedAtMs).toBe(nextAllowedAtMs)
  })
})
