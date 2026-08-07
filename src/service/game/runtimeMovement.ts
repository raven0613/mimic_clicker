import { animationConfig } from '../../configs/animationConfig'
import { jackpotConfig } from '../../configs/jackpotConfig'
import { spawnConfig } from '../../configs/spawnConfig'
import { reflectVelocity, stabilizeJackpotVelocity } from '../combat/combat'
import type { RuntimeMimicEntity } from './runtimeTypes'

export function moveChasingJackpot(
  entity: RuntimeMimicEntity,
  deltaMs: number,
  fieldWidth: number,
  fieldHeight: number,
): void {
  const deltaSeconds = deltaMs / 1_000
  entity.logicalX += entity.jackpotVelocity.x * deltaSeconds
  entity.logicalY += entity.jackpotVelocity.y * deltaSeconds
  const halfWidth = spawnConfig.cardWidthPixels / 2
  const halfHeight = spawnConfig.cardHeightPixels / 2

  if (entity.logicalX < halfWidth && entity.jackpotVelocity.x < 0) {
    entity.logicalX = halfWidth
    entity.jackpotVelocity = stabilizeJackpotVelocity(
      reflectVelocity(entity.jackpotVelocity, { x: 1, y: 0 }),
    )
  } else if (
    entity.logicalX > fieldWidth - halfWidth &&
    entity.jackpotVelocity.x > 0
  ) {
    entity.logicalX = fieldWidth - halfWidth
    entity.jackpotVelocity = stabilizeJackpotVelocity(
      reflectVelocity(entity.jackpotVelocity, { x: -1, y: 0 }),
    )
  }

  if (entity.logicalY < halfHeight && entity.jackpotVelocity.y < 0) {
    entity.logicalY = halfHeight
    entity.jackpotVelocity = stabilizeJackpotVelocity(
      reflectVelocity(entity.jackpotVelocity, { x: 0, y: 1 }),
    )
  } else if (
    entity.logicalY > fieldHeight - halfHeight &&
    entity.jackpotVelocity.y > 0
  ) {
    entity.logicalY = fieldHeight - halfHeight
    entity.jackpotVelocity = stabilizeJackpotVelocity(
      reflectVelocity(entity.jackpotVelocity, { x: 0, y: -1 }),
    )
  }
}

export function updateRuntimeEntityVisual(
  entity: RuntimeMimicEntity,
  deltaMs: number,
  roundElapsedMs: number,
): void {
  if (entity.container.destroyed) return

  entity.hitAnimationRemainingMs = Math.max(
    0,
    entity.hitAnimationRemainingMs - deltaMs,
  )
  const hitProgress = entity.hitAnimationRemainingMs / animationConfig.hit.durationMs
  const hitShake =
    Math.sin(hitProgress * Math.PI * 2 * animationConfig.hit.shakeCycles) *
    animationConfig.hit.shakeDistancePixels *
    hitProgress
  let jackpotStunShake = 0
  if (entity.jackpotLifecycle?.phase === 'stunned') {
    const stunProgress =
      entity.jackpotLifecycle.phaseElapsedMs / jackpotConfig.escapeStunDurationMs
    jackpotStunShake =
      Math.sin(
        stunProgress * Math.PI * 2 * animationConfig.jackpotStun.shakeCycles,
      ) * animationConfig.jackpotStun.shakeDistancePixels
  }

  entity.container.position.set(
    entity.logicalX + hitShake + jackpotStunShake,
    entity.logicalY,
  )
  entity.container.scale.set(1 + animationConfig.hit.scaleImpulse * hitProgress)
  entity.flashSprite.alpha = Math.min(
    animationConfig.hit.maximumFlashAlpha,
    entity.hitAnimationRemainingMs / animationConfig.hit.flashDurationMs,
  )

  if (entity.role === 'jackpot' && entity.jackpotLifecycle?.phase === 'chasing') {
    const speed = Math.max(
      1,
      Math.hypot(entity.jackpotVelocity.x, entity.jackpotVelocity.y),
    )
    entity.container.rotation =
      (entity.jackpotVelocity.x / speed) * jackpotConfig.maximumTiltRadians
  } else if (entity.role === 'jackpotDisguise') {
    entity.container.rotation =
      Math.sin(
        roundElapsedMs / animationConfig.jackpotDisguise.wobblePeriodMs,
      ) * animationConfig.jackpotDisguise.wobbleAmplitudeRadians
  } else {
    entity.container.rotation *= Math.max(
      0,
      1 - deltaMs / animationConfig.hit.rotationReturnDurationMs,
    )
  }
}
