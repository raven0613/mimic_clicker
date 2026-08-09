import { describe, expect, it, vi } from 'vitest'

import { combatConfig } from '../../../configs/combatConfig'
import { equipmentConfig } from '../../../configs/equipmentConfig'
import type { EquipmentRewardSystem } from '../equipment/EquipmentRewardSystem'
import type { RuntimeMimicEntity } from '../runtimeTypes'
import { performRuntimeWeaponAttack } from './runtimeWeaponAttack'

describe('runtime weapon attack', () => {
  it('applies the round weapon damage and records accepted manual hits', () => {
    const entity = createEntity(0)
    const weaponDamage = combatConfig.initialWeaponDamage + 5
    const equipment = createEquipment(weaponDamage)
    const damageTarget = vi.fn(() => true)
    const addManualHitEffect = vi.fn()

    performRuntimeWeaponAttack({
      source: 'manual',
      entity,
      position: { x: 1, y: 2 },
      attackAtMs: 0,
      baseWeaponDamage: weaponDamage - equipmentConfig.sword.weaponDamageBonus,
      equipment,
      damageTarget,
      addManualHitEffect,
    })

    expect(damageTarget).toHaveBeenCalledWith(entity, weaponDamage)
    expect(equipment.recordAcceptedManualHit).toHaveBeenCalledWith({
      targetId: entity.runtimeId,
      targetPosition: { x: entity.logicalX, y: entity.logicalY },
      triggeringWeaponDamage: weaponDamage,
    })
    expect(addManualHitEffect).toHaveBeenCalledWith({ x: 1, y: 2 })
  })

  it('uses the same weapon interval for automatic attacks without counting Ring', () => {
    const entity = createEntity(0)
    const weaponDamage = combatConfig.initialWeaponDamage + 5
    const equipment = createEquipment(weaponDamage)
    const damageTarget = vi.fn(() => true)
    const addManualHitEffect = vi.fn()

    const firstAccepted = performRuntimeWeaponAttack({
      source: 'automatic',
      entity,
      attackAtMs: 0,
      baseWeaponDamage: weaponDamage - equipmentConfig.sword.weaponDamageBonus,
      equipment,
      damageTarget,
      addManualHitEffect,
    })
    const blockedManual = performRuntimeWeaponAttack({
      source: 'manual',
      entity,
      position: { x: 3, y: 4 },
      attackAtMs:
        combatConfig.minimumWeaponDamageIntervalPerTargetMs - 1,
      baseWeaponDamage: weaponDamage - equipmentConfig.sword.weaponDamageBonus,
      equipment,
      damageTarget,
      addManualHitEffect,
    })

    expect(firstAccepted).toBe(true)
    expect(blockedManual).toBe(false)
    expect(damageTarget).toHaveBeenCalledTimes(1)
    expect(equipment.recordAcceptedManualHit).not.toHaveBeenCalled()
    expect(addManualHitEffect).not.toHaveBeenCalled()
  })
})

function createEquipment(weaponDamage: number): EquipmentRewardSystem {
  return {
    calculateWeaponDamage: vi.fn(() => weaponDamage),
    recordAcceptedManualHit: vi.fn(),
  } as unknown as EquipmentRewardSystem
}

function createEntity(nextWeaponDamageAllowedAtMs: number): RuntimeMimicEntity {
  return {
    runtimeId: 9,
    logicalX: 40,
    logicalY: 60,
    nextWeaponDamageAllowedAtMs,
  } as RuntimeMimicEntity
}
