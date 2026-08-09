import { spawnConfig } from '../../../configs/spawnConfig'
import type { RuntimeEffectSystems } from '../RuntimeEffectSystems'
import type { RuntimeMimicEntity } from '../runtimeTypes'

export function addRuntimeDeathEffect(
  systems: RuntimeEffectSystems | null,
  entity: RuntimeMimicEntity,
  reward: number,
  rewardEventId: number,
  fieldHeight: number,
): void {
  systems?.addDeath({
    texture: entity.sprite.texture,
    x: entity.logicalX,
    y: entity.logicalY,
    reward,
    rewardEventId,
    fieldHeight,
    width: spawnConfig.cardWidthPixels,
    height: spawnConfig.cardHeightPixels,
  })
}
