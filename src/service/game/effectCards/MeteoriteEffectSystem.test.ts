import { describe, expect, it, vi } from 'vitest'

import { Container, Texture } from 'pixi.js'

import { effectCardConfig } from '../../../configs/effectCardConfig'
import type { RuntimeMimicEntity } from '../runtimeTypes'
import { MeteoriteEffectSystem } from './MeteoriteEffectSystem'

const textures = {
  meteoriteFrames: Array.from(
    { length: effectCardConfig.meteorite.spriteSheet.frameCount },
    () => Texture.EMPTY,
  ),
  explosionFrames: Array.from(
    { length: effectCardConfig.meteorite.explosionSpriteSheet.frameCount },
    () => Texture.EMPTY,
  ),
}

describe('meteorite effect system', () => {
  it('launches the first meteorite immediately when an eligible target exists', () => {
    const layer = new Container()
    const system = createSystem(layer, [createTarget()])

    system.trigger()

    expect(layer.children).toHaveLength(1)
  })

  it('waits for a first target, then falls back without cancelling the cast', () => {
    const layer = new Container()
    const system = createSystem(layer, [])

    system.trigger()
    expect(system.hasActiveEffects()).toBe(true)
    expect(layer.children).toHaveLength(0)

    system.update(effectCardConfig.meteorite.maximumFirstTargetWaitMs - 1)
    expect(layer.children).toHaveLength(0)
    system.update(1)
    expect(layer.children).toHaveLength(1)
  })

  it('launches during the wait as soon as an eligible target appears', () => {
    const layer = new Container()
    const targets: RuntimeMimicEntity[] = []
    const system = createSystem(layer, targets)

    system.trigger()
    system.update(effectCardConfig.meteorite.maximumFirstTargetWaitMs / 2)
    targets.push(createTarget())
    system.update(1)

    expect(layer.children).toHaveLength(1)
  })

  it('starts the second launch interval after the delayed first launch', () => {
    const layer = new Container()
    const system = createSystem(layer, [])

    system.trigger()
    system.update(effectCardConfig.meteorite.maximumFirstTargetWaitMs)
    system.update(effectCardConfig.meteorite.minimumLaunchIntervalMs - 1)
    expect(layer.children).toHaveLength(1)
    system.update(1)
    expect(layer.children).toHaveLength(2)
  })
})

function createSystem(
  layer: Container,
  targets: RuntimeMimicEntity[],
): MeteoriteEffectSystem {
  return new MeteoriteEffectSystem(
    layer,
    textures,
    () => 0,
    () => ({ width: 1_280, height: 720 }),
    () => targets,
    vi.fn(),
  )
}

function createTarget(): RuntimeMimicEntity {
  return {
    runtimeId: 1,
    mimicId: 'normal',
    role: 'regular',
    container: new Container(),
    visualContainer: new Container(),
    sprite: null!,
    flashSprite: null!,
    health: 100,
    maximumHealth: 100,
    crackVisual: null,
    logicalX: 500,
    logicalY: 400,
    downwardSpeedPixelsPerSecond: 0,
    hitAnimationRemainingMs: 0,
    refillEntranceElapsedMs: null,
    nextWeaponDamageAllowedAtMs: 0,
    jackpotLifecycle: null,
    jackpotVelocity: { x: 0, y: 0 },
    attachedCardFan: null,
    attachedCards: [],
    hiddenEquipmentId: null,
  }
}
