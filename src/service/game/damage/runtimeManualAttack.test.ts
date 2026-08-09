import { describe, expect, it, vi } from 'vitest'

import { combatConfig } from '../../../configs/combatConfig'
import { equipmentConfig } from '../../../configs/equipmentConfig'
import type { EquipmentRewardSystem } from '../equipment/EquipmentRewardSystem'
import type { RuntimeMimicEntity } from '../runtimeTypes'
import { performRuntimeManualAttack } from './runtimeManualAttack'

describe('runtime manual attack', () => {
  it('applies equipped weapon damage and records only an accepted hit', () => {
    const entity = createEntity(0)
    const equipment = {
      calculateWeaponDamage: vi.fn(
        () =>
          combatConfig.initialWeaponDamage +
          equipmentConfig.sword.weaponDamageBonus,
      ),
      recordAcceptedManualHit: vi.fn(),
    } as unknown as EquipmentRewardSystem
    const damageTarget = vi.fn(() => true)
    const addHitEffect = vi.fn()

    performRuntimeManualAttack({
      entity,
      position: { x: 1, y: 2 },
      attackAtMs: 0,
      equipment,
      damageTarget,
      addHitEffect,
    })

    const weaponDamage =
      combatConfig.initialWeaponDamage +
      equipmentConfig.sword.weaponDamageBonus
    expect(damageTarget).toHaveBeenCalledWith(entity, weaponDamage)
    expect(equipment.recordAcceptedManualHit).toHaveBeenCalledWith({
      targetId: entity.runtimeId,
      targetPosition: {
        x: entity.logicalX,
        y: entity.logicalY,
      },
      triggeringWeaponDamage: weaponDamage,
    })
    expect(addHitEffect).toHaveBeenCalledOnce()
  })

  it('does not damage, show a hit, or count Ring during the target interval', () => {
    const entity = createEntity(
      combatConfig.minimumWeaponDamageIntervalPerTargetMs,
    )
    const equipment = {
      calculateWeaponDamage: vi.fn(),
      recordAcceptedManualHit: vi.fn(),
    } as unknown as EquipmentRewardSystem
    const damageTarget = vi.fn(() => true)
    const addHitEffect = vi.fn()

    performRuntimeManualAttack({
      entity,
      position: { x: 1, y: 2 },
      attackAtMs: 0,
      equipment,
      damageTarget,
      addHitEffect,
    })

    expect(damageTarget).not.toHaveBeenCalled()
    expect(addHitEffect).not.toHaveBeenCalled()
    expect(equipment.recordAcceptedManualHit).not.toHaveBeenCalled()
  })
})

function createEntity(nextWeaponDamageAllowedAtMs: number): RuntimeMimicEntity {
  return {
    runtimeId: 9,
    logicalX: 40,
    logicalY: 60,
    nextWeaponDamageAllowedAtMs,
  } as RuntimeMimicEntity
}
