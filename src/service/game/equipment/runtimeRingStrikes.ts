import { equipmentConfig } from '../../../configs/equipmentConfig'
import type { Vector2 } from '../../../types/game'
import type { RuntimeMimicEntity } from '../runtimeTypes'
import type { EquipmentRewardSystem } from './EquipmentRewardSystem'

interface ResolveRuntimeRingStrikesInput {
  equipment: EquipmentRewardSystem | null
  deltaMs: number
  includeEndpoint?: boolean
  entities: readonly RuntimeMimicEntity[]
  damageTarget: (target: RuntimeMimicEntity, damage: number) => void
  addHitEffect: (position: Vector2, tintColor?: string) => void
}

export function resolveRuntimeRingStrikes(
  input: ResolveRuntimeRingStrikesInput,
): void {
  if (!input.equipment) return
  for (const strike of input.equipment.advanceRingQueue(
    input.deltaMs,
    input.includeEndpoint,
  )) {
    const target = input.entities.find(
      (entity) => entity.runtimeId === strike.targetId,
    )
    if (target) input.damageTarget(target, strike.damage)
    input.addHitEffect(
      {
        x:
          strike.hitEffectOrigin.x +
          equipmentConfig.ring.additionalHitEffectOffset.x,
        y:
          strike.hitEffectOrigin.y +
          equipmentConfig.ring.additionalHitEffectOffset.y,
      },
      equipmentConfig.ring.additionalHitEffectTintColor,
    )
  }
}
