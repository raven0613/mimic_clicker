import type { Texture } from 'pixi.js'

import { jackpotConfig } from '../../../configs/jackpotConfig'
import type { RandomSource } from '../../../types/game'
import { resetRuntimeMimicHealth } from '../damage/runtimeMimicDamage'
import type { RuntimeMimicEntity } from '../runtimeTypes'

export function revealRuntimeJackpot(
  entity: RuntimeMimicEntity,
  jackpotTexture: Texture,
  random: RandomSource,
): void {
  entity.role = 'jackpot'
  entity.sprite.texture = jackpotTexture
  entity.flashSprite.texture = jackpotTexture
  resetRuntimeMimicHealth(entity, jackpotConfig.maximumHealth)
  entity.container.zIndex = 100

  const directionRange =
    jackpotConfig.initialDirectionMaximumRadians -
    jackpotConfig.initialDirectionMinimumRadians
  const angle =
    jackpotConfig.initialDirectionMinimumRadians + random() * directionRange
  const horizontalDirection = random() < 0.5 ? -1 : 1
  entity.jackpotVelocity = {
    x:
      Math.cos(angle) *
      jackpotConfig.chaseSpeedPixelsPerSecond *
      horizontalDirection,
    y: Math.sin(angle) * jackpotConfig.chaseSpeedPixelsPerSecond,
  }
  entity.jackpotLifecycle = {
    phase: 'chasing',
    remainingChaseMs: jackpotConfig.chaseDurationMs,
    phaseElapsedMs: 0,
    lockedEscapeX: null,
  }
}
