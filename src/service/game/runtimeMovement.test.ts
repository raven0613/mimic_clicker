import type { Container, Sprite } from 'pixi.js'
import { describe, expect, it } from 'vitest'

import type { RuntimeMimicEntity } from './runtimeTypes'
import { updateRuntimeEntityVisual } from './runtimeMovement'

function createEscapingJackpotEntity(): RuntimeMimicEntity {
  const container = {
    destroyed: true,
    position: null,
    scale: null,
    rotation: 0,
  } as unknown as Container
  const sprite = {} as Sprite
  const flashSprite = { alpha: 0 } as Sprite

  return {
    runtimeId: 1,
    mimicId: 'normal',
    role: 'jackpot',
    container,
    sprite,
    flashSprite,
    health: null,
    maximumHealth: null,
    crackVisual: null,
    logicalX: 0,
    logicalY: 0,
    downwardSpeedPixelsPerSecond: 0,
    hitAnimationRemainingMs: 0,
    nextWeaponDamageAllowedAtMs: 0,
    jackpotLifecycle: {
      phase: 'escaping',
      remainingChaseMs: 0,
      phaseElapsedMs: 0,
      lockedEscapeX: 0,
    },
    jackpotVelocity: { x: 0, y: 0 },
    attachedCardFan: null,
    attachedCards: [],
    hiddenEquipmentId: null,
  }
}

describe('runtime entity visual updates', () => {
  it('does not access transforms after the entity was destroyed earlier in the frame', () => {
    const entity = createEscapingJackpotEntity()

    expect(() => updateRuntimeEntityVisual(entity, 0, 0)).not.toThrow()
  })
})
