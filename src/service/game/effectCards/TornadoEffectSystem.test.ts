import { describe, expect, it, vi } from 'vitest'

import { Container, Texture } from 'pixi.js'

import { effectCardConfig } from '../../../configs/effectCardConfig'
import type { RuntimeMimicEntity } from '../runtimeTypes'
import { TornadoEffectSystem } from './TornadoEffectSystem'

const textures = {
  tornadoStartFrames: Array.from(
    { length: effectCardConfig.tornado.spriteSheets.start.frameCount },
    () => Texture.EMPTY,
  ),
  tornadoRunFrames: Array.from(
    { length: effectCardConfig.tornado.spriteSheets.run.frameCount },
    () => Texture.EMPTY,
  ),
  tornadoEndFrames: Array.from(
    { length: effectCardConfig.tornado.spriteSheets.end.frameCount },
    () => Texture.EMPTY,
  ),
}

describe('tornado effect system', () => {
  it('damages immediately on entering run and resets cooldown on Jackpot reveal', () => {
    const target = createTarget()
    const damageTarget = vi.fn()
    const system = new TornadoEffectSystem(
      new Container(),
      textures,
      () => 0.25,
      () => ({ width: 1_280, height: 720 }),
      () => [target],
      damageTarget,
    )

    system.trigger({ x: target.logicalX, y: target.logicalY })
    system.update(effectCardConfig.tornado.startAnimationDurationMs - 1)
    expect(damageTarget).not.toHaveBeenCalled()

    system.update(1)
    expect(damageTarget).toHaveBeenCalledTimes(1)

    system.update(effectCardConfig.tornado.damageIntervalPerTargetMs - 1)
    expect(damageTarget).toHaveBeenCalledTimes(1)

    target.role = 'jackpot'
    target.jackpotLifecycle = {
      phase: 'chasing',
      remainingChaseMs: 1_000,
      phaseElapsedMs: 0,
      lockedEscapeX: null,
    }
    system.resetTargetDamageInterval(target)
    system.update(1)

    expect(damageTarget).toHaveBeenCalledTimes(2)
  })

  it('clears unresolved start animations without causing damage', () => {
    const target = createTarget()
    const damageTarget = vi.fn()
    const system = new TornadoEffectSystem(
      new Container(),
      textures,
      () => 0.25,
      () => ({ width: 1_280, height: 720 }),
      () => [target],
      damageTarget,
    )

    system.trigger({ x: target.logicalX, y: target.logicalY })
    system.clear()
    system.update(
      effectCardConfig.tornado.startAnimationDurationMs +
        effectCardConfig.tornado.runDurationMs,
    )

    expect(damageTarget).not.toHaveBeenCalled()
  })

  it('keeps moving through end and removes the sprite after all phases', () => {
    const layer = new Container()
    const system = new TornadoEffectSystem(
      layer,
      textures,
      () => 0,
      () => ({ width: 1_280, height: 720 }),
      () => [],
      vi.fn(),
    )

    system.trigger({ x: 500, y: 400 })
    system.update(
      effectCardConfig.tornado.startAnimationDurationMs +
        effectCardConfig.tornado.runDurationMs,
    )
    const sprite = layer.children[0]
    const endStartPosition = { x: sprite.x, y: sprite.y }

    system.update(effectCardConfig.tornado.endAnimationDurationMs / 2)
    expect({ x: sprite.x, y: sprite.y }).not.toEqual(endStartPosition)
    expect(layer.children).toHaveLength(1)

    system.update(effectCardConfig.tornado.endAnimationDurationMs / 2)
    expect(layer.children).toHaveLength(0)
  })
})

function createTarget(): RuntimeMimicEntity {
  return {
    runtimeId: 1,
    mimicId: 'normal',
    role: 'regular',
    container: new Container(),
    sprite: null!,
    flashSprite: null!,
    health: 100,
    maximumHealth: 100,
    crackVisual: null,
    logicalX: 500,
    logicalY: 400,
    downwardSpeedPixelsPerSecond: 0,
    hitAnimationRemainingMs: 0,
    nextWeaponDamageAllowedAtMs: 0,
    jackpotLifecycle: null,
    jackpotVelocity: { x: 0, y: 0 },
    attachedCardFan: null,
    attachedCards: [],
    hiddenEquipmentId: null,
  }
}
