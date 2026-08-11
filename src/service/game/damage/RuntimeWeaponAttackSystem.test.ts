import { describe, expect, it, vi } from 'vitest'

import { permanentUpgradeConfig } from '../../../configs/permanentUpgradeConfig'
import { weaponConfig } from '../../../configs/weaponConfig'
import type { RoundProgressionSnapshot } from '../../../types/game'
import type { RuntimeMimicEntity } from '../runtimeTypes'
import { findWeaponDefinition } from '../../progression/weaponProgression'
import { RuntimeWeaponAttackSystem } from './RuntimeWeaponAttackSystem'

describe('runtime weapon attack system hover position', () => {
  it('uses the latest pointer position without resetting the same target timer', () => {
    const entity = createEntity()
    const entities = [entity]
    const damageTarget = vi.fn(() => true)
    const addWeaponHitEffect = vi.fn()
    let roundElapsedMs = 0
    const system = new RuntimeWeaponAttackSystem({
      getRoundElapsedMs: () => roundElapsedMs,
      getEntities: () => entities,
      getEquipment: () => null,
      damageTarget,
      addWeaponHitEffect,
    })
    const intervalMs =
      permanentUpgradeConfig.hoverAutoAttack.intervalMsByLevel[0]
    system.startRound(createUpgradeSnapshot(intervalMs))
    system.setHoverPosition(entity, { x: 20, y: 30 })

    roundElapsedMs += intervalMs - 1
    system.update(intervalMs - 1, true)
    system.setHoverPosition(entity, { x: 50, y: 70 })
    roundElapsedMs += 1
    system.update(1, true)

    expect(damageTarget).toHaveBeenCalledOnce()
    expect(addWeaponHitEffect).toHaveBeenCalledWith(
      {
        x: 50 + permanentUpgradeConfig.hoverAutoAttack.hitEffectOffset.x,
        y: 70 + permanentUpgradeConfig.hoverAutoAttack.hitEffectOffset.y,
      },
      permanentUpgradeConfig.hoverAutoAttack.hitEffectTintColor,
    )
  })

  it('clears both the hovered target and pointer position on leave', () => {
    const entity = createEntity()
    const damageTarget = vi.fn(() => true)
    const addWeaponHitEffect = vi.fn()
    const system = new RuntimeWeaponAttackSystem({
      getRoundElapsedMs: () => 0,
      getEntities: () => [entity],
      getEquipment: () => null,
      damageTarget,
      addWeaponHitEffect,
    })
    const intervalMs =
      permanentUpgradeConfig.hoverAutoAttack.intervalMsByLevel[0]
    system.startRound(createUpgradeSnapshot(intervalMs))
    system.setHoverPosition(entity, { x: 20, y: 30 })

    system.setHoverPosition(entity, null)
    system.update(intervalMs, true)

    expect(damageTarget).not.toHaveBeenCalled()
    expect(addWeaponHitEffect).not.toHaveBeenCalled()
  })

  it('clears the pointer position when the hovered entity becomes invalid', () => {
    const entity = createEntity()
    const entities = [entity]
    const damageTarget = vi.fn(() => true)
    const addWeaponHitEffect = vi.fn()
    const system = new RuntimeWeaponAttackSystem({
      getRoundElapsedMs: () => 0,
      getEntities: () => entities,
      getEquipment: () => null,
      damageTarget,
      addWeaponHitEffect,
    })
    const intervalMs =
      permanentUpgradeConfig.hoverAutoAttack.intervalMsByLevel[0]
    system.startRound(createUpgradeSnapshot(intervalMs))
    system.setHoverPosition(entity, { x: 20, y: 30 })

    entities.length = 0
    system.update(intervalMs, true)

    expect(damageTarget).not.toHaveBeenCalled()
    expect(addWeaponHitEffect).not.toHaveBeenCalled()
  })
})

function createUpgradeSnapshot(intervalMs: number): RoundProgressionSnapshot {
  const definition = findWeaponDefinition(weaponConfig.initialWeaponId)
  if (!definition) throw new Error('Missing initial weapon test definition')
  return {
    weapon: { id: definition.id, baseDamage: definition.baseDamage },
    hoverAutoAttack: { isUnlocked: true, intervalMs },
    equipmentSlotCount: 2,
  }
}

function createEntity(): RuntimeMimicEntity {
  return {
    runtimeId: 1,
    nextWeaponDamageAllowedAtMs: 0,
  } as RuntimeMimicEntity
}
