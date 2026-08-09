import type { Vector2 } from '../../../types/game'
import type { EquipmentRewardSystem } from '../equipment/EquipmentRewardSystem'
import type { RuntimeMimicEntity } from '../runtimeTypes'
import { evaluateWeaponDamageInterval } from './weaponDamageInterval'

interface PerformRuntimeWeaponAttackInput {
  source: 'manual' | 'automatic'
  entity: RuntimeMimicEntity
  position?: Vector2
  attackAtMs: number
  baseWeaponDamage: number
  equipment: EquipmentRewardSystem | null
  damageTarget: (entity: RuntimeMimicEntity, damage: number) => boolean
  addManualHitEffect: (position: Vector2) => void
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
  if (input.source === 'automatic') return true
  if (!input.position) {
    throw new Error('A manual weapon attack requires a hit position')
  }

  input.addManualHitEffect(input.position)
  input.equipment?.recordAcceptedManualHit({
    targetId: input.entity.runtimeId,
    targetPosition: {
      x: input.entity.logicalX,
      y: input.entity.logicalY,
    },
    triggeringWeaponDamage: weaponDamage,
  })
  return true
}
