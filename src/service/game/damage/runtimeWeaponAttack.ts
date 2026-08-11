import { permanentUpgradeConfig } from '../../../configs/permanentUpgradeConfig'
import type { Vector2 } from '../../../types/game'
import type { EquipmentRewardSystem } from '../equipment/EquipmentRewardSystem'
import type { RuntimeMimicEntity } from '../runtimeTypes'
import { evaluateWeaponDamageInterval } from './weaponDamageInterval'

interface PerformRuntimeWeaponAttackInput {
  source: 'manual' | 'automatic'
  entity: RuntimeMimicEntity
  pointerPosition: Vector2
  attackAtMs: number
  baseWeaponDamage: number
  equipment: EquipmentRewardSystem | null
  damageTarget: (entity: RuntimeMimicEntity, damage: number) => boolean
  addWeaponHitEffect: (position: Vector2, tintColor?: string) => void
}

export function performRuntimeWeaponAttack(
  input: PerformRuntimeWeaponAttackInput,
): boolean {
  const interval = evaluateWeaponDamageInterval(
    input.entity.nextWeaponDamageAllowedAtMs,
    input.attackAtMs,
  )
  if (!interval.isAllowed) return false

  const weaponDamage =
    input.equipment?.calculateWeaponDamage(input.baseWeaponDamage) ??
    input.baseWeaponDamage
  if (!input.damageTarget(input.entity, weaponDamage)) return false

  input.entity.nextWeaponDamageAllowedAtMs = interval.nextAllowedAtMs
  if (input.source === 'automatic') {
    input.addWeaponHitEffect(
      {
        x:
          input.pointerPosition.x +
          permanentUpgradeConfig.hoverAutoAttack.hitEffectOffset.x,
        y:
          input.pointerPosition.y +
          permanentUpgradeConfig.hoverAutoAttack.hitEffectOffset.y,
      },
      permanentUpgradeConfig.hoverAutoAttack.hitEffectTintColor,
    )
    return true
  }

  input.addWeaponHitEffect(input.pointerPosition)
  input.equipment?.recordAcceptedManualHit({
    targetId: input.entity.runtimeId,
    hitEffectOrigin: { ...input.pointerPosition },
    triggeringWeaponDamage: weaponDamage,
  })
  return true
}
