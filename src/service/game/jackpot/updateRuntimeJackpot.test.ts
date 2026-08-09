import type { Container, Sprite } from 'pixi.js'
import { describe, expect, it } from 'vitest'

import { jackpotConfig } from '../../../configs/jackpotConfig'
import { combatConfig } from '../../../configs/combatConfig'
import { spawnConfig } from '../../../configs/spawnConfig'
import type { JackpotLifecycle } from '../../combat/combat'
import type { RuntimeMimicEntity } from '../runtimeTypes'
import { updateRuntimeJackpot } from './updateRuntimeJackpot'

describe('runtime Jackpot update', () => {
  it('reports escape when chase time advances into the next phase', () => {
    const entity = createJackpotEntity({
      phase: 'chasing',
      remainingChaseMs: 0,
      phaseElapsedMs: 0,
      lockedEscapeX: null,
    })

    expect(
      updateRuntimeJackpot(
        entity,
        combatConfig.maximumFrameDeltaMs,
        spawnConfig.cardWidthPixels * 6,
        spawnConfig.cardHeightPixels * 4,
      ),
    ).toBe('escaped')
    expect(entity.jackpotLifecycle?.phase).not.toBe('chasing')
  })

  it('keeps the locked escape x and reports bottom flow exit', () => {
    const fieldHeight = spawnConfig.cardHeightPixels * 4
    const lockedEscapeX = spawnConfig.cardWidthPixels
    const entity = createJackpotEntity({
      phase: 'escaping',
      remainingChaseMs: 0,
      phaseElapsedMs: 0,
      lockedEscapeX,
    })
    entity.logicalX = lockedEscapeX * 2
    entity.logicalY = fieldHeight + spawnConfig.cardHeightPixels / 2 - 1
    const exitDeltaMs =
      (2 / jackpotConfig.escapeSpeedPixelsPerSecond) * 1_000

    expect(
      updateRuntimeJackpot(
        entity,
        exitDeltaMs,
        spawnConfig.cardWidthPixels * 6,
        fieldHeight,
      ),
    ).toBe('flowExited')
    expect(entity.logicalX).toBe(lockedEscapeX)
  })
})

function createJackpotEntity(
  jackpotLifecycle: JackpotLifecycle,
): RuntimeMimicEntity {
  return {
    runtimeId: 1,
    mimicId: 'normal',
    role: 'jackpot',
    container: {} as Container,
    visualContainer: {} as Container,
    sprite: {} as Sprite,
    flashSprite: {} as Sprite,
    health: null,
    maximumHealth: null,
    crackVisual: null,
    logicalX: 0,
    logicalY: 0,
    downwardSpeedPixelsPerSecond: 0,
    hitAnimationRemainingMs: 0,
    refillEntranceElapsedMs: null,
    nextWeaponDamageAllowedAtMs: 0,
    jackpotLifecycle,
    jackpotVelocity: { x: 0, y: 0 },
    attachedCardFan: null,
    attachedCards: [],
    hiddenEquipmentId: null,
  }
}
