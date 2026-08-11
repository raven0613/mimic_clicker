import { describe, expect, it, vi } from 'vitest'

import { combatConfig } from '../../../configs/combatConfig'
import { equipmentConfig } from '../../../configs/equipmentConfig'
import { permanentUpgradeConfig } from '../../../configs/permanentUpgradeConfig'
import type { EquipmentRewardSystem } from '../equipment/EquipmentRewardSystem'
import type { RuntimeMimicEntity } from '../runtimeTypes'
import { getInitialWeaponDefinition } from '../../progression/weaponProgression'
import { performRuntimeWeaponAttack } from './runtimeWeaponAttack'

describe('runtime weapon attack', () => {
  it('applies the round weapon damage and records accepted manual hits', () => {
    const entity = createEntity(0)
    const weaponDamage = getInitialWeaponDefinition().baseDamage + 5
    const equipment = createEquipment(weaponDamage)
    const damageTarget = vi.fn(() => true)
    const addWeaponHitEffect = vi.fn()

    performRuntimeWeaponAttack({
      source: 'manual',
      entity,
      pointerPosition: { x: 1, y: 2 },
      attackAtMs: 0,
      baseWeaponDamage: weaponDamage - equipmentConfig.sword.weaponDamageBonus,
      equipment,
      damageTarget,
      addWeaponHitEffect,
    })

    expect(damageTarget).toHaveBeenCalledWith(entity, weaponDamage)
    expect(equipment.recordAcceptedManualHit).toHaveBeenCalledWith({
      targetId: entity.runtimeId,
      hitEffectOrigin: { x: 1, y: 2 },
      triggeringWeaponDamage: weaponDamage,
    })
    expect(addWeaponHitEffect).toHaveBeenCalledWith({ x: 1, y: 2 })
  })

  it('shows an automatic hit at the configured offset without counting Ring', () => {
    const entity = createEntity(0)
    const weaponDamage = getInitialWeaponDefinition().baseDamage + 5
    const equipment = createEquipment(weaponDamage)
    const damageTarget = vi.fn(() => true)
    const addWeaponHitEffect = vi.fn()
    const pointerPosition = { x: 30, y: 40 }

    const firstAccepted = performRuntimeWeaponAttack({
      source: 'automatic',
      entity,
      pointerPosition,
      attackAtMs: 0,
      baseWeaponDamage: weaponDamage - equipmentConfig.sword.weaponDamageBonus,
      equipment,
      damageTarget,
      addWeaponHitEffect,
    })
    const blockedManual = performRuntimeWeaponAttack({
      source: 'manual',
      entity,
      pointerPosition: { x: 3, y: 4 },
      attackAtMs:
        combatConfig.minimumWeaponDamageIntervalPerTargetMs - 1,
      baseWeaponDamage: weaponDamage - equipmentConfig.sword.weaponDamageBonus,
      equipment,
      damageTarget,
      addWeaponHitEffect,
    })

    expect(firstAccepted).toBe(true)
    expect(blockedManual).toBe(false)
    expect(damageTarget).toHaveBeenCalledTimes(1)
    expect(equipment.recordAcceptedManualHit).not.toHaveBeenCalled()
    expect(addWeaponHitEffect).toHaveBeenCalledOnce()
    expect(addWeaponHitEffect).toHaveBeenCalledWith(
      {
        x: pointerPosition.x +
          permanentUpgradeConfig.hoverAutoAttack.hitEffectOffset.x,
        y: pointerPosition.y +
          permanentUpgradeConfig.hoverAutoAttack.hitEffectOffset.y,
      },
      permanentUpgradeConfig.hoverAutoAttack.hitEffectTintColor,
    )
  })

  it('does not show an automatic hit when the weapon interval rejects it', () => {
    const entity = createEntity(
      combatConfig.minimumWeaponDamageIntervalPerTargetMs,
    )
    const damageTarget = vi.fn(() => true)
    const addWeaponHitEffect = vi.fn()

    const accepted = performRuntimeWeaponAttack({
      source: 'automatic',
      entity,
      pointerPosition: { x: 10, y: 20 },
      attackAtMs: combatConfig.minimumWeaponDamageIntervalPerTargetMs - 1,
      baseWeaponDamage: getInitialWeaponDefinition().baseDamage,
      equipment: null,
      damageTarget,
      addWeaponHitEffect,
    })

    expect(accepted).toBe(false)
    expect(damageTarget).not.toHaveBeenCalled()
    expect(addWeaponHitEffect).not.toHaveBeenCalled()
  })

  it('does not show an automatic hit when damage application rejects it', () => {
    const entity = createEntity(0)
    const addWeaponHitEffect = vi.fn()

    const accepted = performRuntimeWeaponAttack({
      source: 'automatic',
      entity,
      pointerPosition: { x: 10, y: 20 },
      attackAtMs: 0,
      baseWeaponDamage: getInitialWeaponDefinition().baseDamage,
      equipment: null,
      damageTarget: vi.fn(() => false),
      addWeaponHitEffect,
    })

    expect(accepted).toBe(false)
    expect(addWeaponHitEffect).not.toHaveBeenCalled()
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
