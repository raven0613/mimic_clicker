import { combatConfig } from '../../../configs/combatConfig'
import type { Vector2 } from '../../../types/game'
import type { EquipmentRewardSystem } from '../equipment/EquipmentRewardSystem'
import type { RuntimeMimicEntity } from '../runtimeTypes'
import { evaluateWeaponDamageInterval } from './weaponDamageInterval'

interface PerformRuntimeManualAttackInput {
  entity: RuntimeMimicEntity
  position: Vector2
  attackAtMs: number
  equipment: EquipmentRewardSystem | null
  damageTarget: (entity: RuntimeMimicEntity, damage: number) => boolean
  addHitEffect: (position: Vector2) => void
}

export function performRuntimeManualAttack(
  input: PerformRuntimeManualAttackInput,
): void {
  const interval = evaluateWeaponDamageInterval(
    input.entity.nextWeaponDamageAllowedAtMs,
    input.attackAtMs,
  )
  if (!interval.isAllowed) return
  const weaponDamage =
    input.equipment?.calculateWeaponDamage(combatConfig.initialWeaponDamage) ??
    combatConfig.initialWeaponDamage
  if (!input.damageTarget(input.entity, weaponDamage)) return

  input.entity.nextWeaponDamageAllowedAtMs = interval.nextAllowedAtMs
  input.addHitEffect(input.position)
  input.equipment?.recordAcceptedManualHit({
    targetId: input.entity.runtimeId,
    triggeringWeaponDamage: weaponDamage,
  })
}
