import { jackpotConfig } from '../../../configs/jackpotConfig'
import { spawnConfig } from '../../../configs/spawnConfig'
import { advanceJackpotLifecycle } from '../../combat/combat'
import { moveChasingJackpot } from '../runtimeMovement'
import type { RuntimeMimicEntity } from '../runtimeTypes'

export type RuntimeJackpotUpdateResult = 'none' | 'escaped' | 'flowExited'

export function updateRuntimeJackpot(
  entity: RuntimeMimicEntity,
  deltaMs: number,
  fieldWidth: number,
  fieldHeight: number,
): RuntimeJackpotUpdateResult {
  const lifecycle = entity.jackpotLifecycle
  if (!lifecycle) return 'none'

  if (lifecycle.phase === 'chasing') {
    entity.jackpotLifecycle = advanceJackpotLifecycle(
      lifecycle,
      deltaMs,
      entity.logicalX,
    )
    if (entity.jackpotLifecycle.phase !== 'chasing') return 'escaped'
    moveChasingJackpot(entity, deltaMs, fieldWidth, fieldHeight)
    return 'none'
  }

  if (lifecycle.phase === 'stunned') {
    entity.jackpotLifecycle = advanceJackpotLifecycle(
      lifecycle,
      deltaMs,
      entity.logicalX,
    )
    return 'none'
  }

  entity.logicalX = lifecycle.lockedEscapeX ?? entity.logicalX
  entity.logicalY +=
    jackpotConfig.escapeSpeedPixelsPerSecond * (deltaMs / 1_000)
  return entity.logicalY - spawnConfig.cardHeightPixels / 2 > fieldHeight
    ? 'flowExited'
    : 'none'
}
