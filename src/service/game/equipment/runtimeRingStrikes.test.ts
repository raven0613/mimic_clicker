import { describe, expect, it, vi } from 'vitest'

import { combatConfig } from '../../../configs/combatConfig'
import { equipmentConfig } from '../../../configs/equipmentConfig'
import type { RuntimeMimicEntity } from '../runtimeTypes'
import type { EquipmentRewardSystem } from './EquipmentRewardSystem'
import { resolveRuntimeRingStrikes } from './runtimeRingStrikes'

describe('runtime Ring strikes', () => {
  it('damages the same runtime identity and offsets the hit visual', () => {
    const target = {
      runtimeId: 7,
      logicalX: 100,
      logicalY: 200,
    } as RuntimeMimicEntity
    const equipment = createEquipmentStub([
      {
        targetId: target.runtimeId,
        targetPosition: { x: 80, y: 160 },
        damage: combatConfig.initialWeaponDamage,
      },
    ])
    const damageTarget = vi.fn(() => true)
    const addHitEffect = vi.fn()

    resolveRuntimeRingStrikes({
      equipment,
      deltaMs: equipmentConfig.ring.additionalHitIntervalMs,
      entities: [target],
      damageTarget,
      addHitEffect,
    })

    expect(damageTarget).toHaveBeenCalledWith(
      target,
      combatConfig.initialWeaponDamage,
    )
    expect(addHitEffect).toHaveBeenCalledWith(
      {
        x: target.logicalX +
          equipmentConfig.ring.additionalHitEffectOffset.x,
        y: target.logicalY +
          equipmentConfig.ring.additionalHitEffectOffset.y,
      },
      equipmentConfig.ring.additionalHitEffectTintColor,
    )
  })

  it('shows the queued hit at its snapshot position when the target is gone', () => {
    const targetPosition = { x: 80, y: 160 }
    const equipment = createEquipmentStub([
      {
        targetId: 99,
        targetPosition,
        damage: combatConfig.initialWeaponDamage,
      },
    ])
    const damageTarget = vi.fn(() => false)
    const addHitEffect = vi.fn()

    resolveRuntimeRingStrikes({
      equipment,
      deltaMs: equipmentConfig.ring.additionalHitIntervalMs,
      entities: [],
      damageTarget,
      addHitEffect,
    })

    expect(damageTarget).not.toHaveBeenCalled()
    expect(addHitEffect).toHaveBeenCalledWith(
      {
        x: targetPosition.x +
          equipmentConfig.ring.additionalHitEffectOffset.x,
        y: targetPosition.y +
          equipmentConfig.ring.additionalHitEffectOffset.y,
      },
      equipmentConfig.ring.additionalHitEffectTintColor,
    )
  })

  it('shows every queued hit after an earlier Ring strike kills the target', () => {
    const target = {
      runtimeId: 8,
      logicalX: 100,
      logicalY: 200,
    } as RuntimeMimicEntity
    const entities = [target]
    const equipment = createEquipmentStub([
      {
        targetId: target.runtimeId,
        targetPosition: { x: 90, y: 190 },
        damage: combatConfig.initialWeaponDamage,
      },
      {
        targetId: target.runtimeId,
        targetPosition: { x: 90, y: 190 },
        damage: combatConfig.initialWeaponDamage,
      },
    ])
    const damageTarget = vi.fn(() => {
      entities.splice(0, 1)
      return true
    })
    const addHitEffect = vi.fn()

    resolveRuntimeRingStrikes({
      equipment,
      deltaMs: equipmentConfig.ring.additionalHitIntervalMs,
      entities,
      damageTarget,
      addHitEffect,
    })
    resolveRuntimeRingStrikes({
      equipment,
      deltaMs: equipmentConfig.ring.additionalHitIntervalMs,
      entities,
      damageTarget,
      addHitEffect,
    })

    expect(damageTarget).toHaveBeenCalledOnce()
    expect(addHitEffect).toHaveBeenNthCalledWith(
      1,
      {
        x: target.logicalX +
          equipmentConfig.ring.additionalHitEffectOffset.x,
        y: target.logicalY +
          equipmentConfig.ring.additionalHitEffectOffset.y,
      },
      equipmentConfig.ring.additionalHitEffectTintColor,
    )
    expect(addHitEffect).toHaveBeenNthCalledWith(
      2,
      {
        x: 90 + equipmentConfig.ring.additionalHitEffectOffset.x,
        y: 190 + equipmentConfig.ring.additionalHitEffectOffset.y,
      },
      equipmentConfig.ring.additionalHitEffectTintColor,
    )
  })

  it('forwards an excluded round endpoint to the Ring queue', () => {
    const equipment = createEquipmentStub([])

    resolveRuntimeRingStrikes({
      equipment,
      deltaMs: equipmentConfig.ring.additionalHitIntervalMs,
      includeEndpoint: false,
      entities: [],
      damageTarget: vi.fn(() => true),
      addHitEffect: vi.fn(),
    })

    expect(equipment.advanceRingQueue).toHaveBeenCalledWith(
      equipmentConfig.ring.additionalHitIntervalMs,
      false,
    )
  })
})

function createEquipmentStub(
  strikes: ReturnType<EquipmentRewardSystem['advanceRingQueue']>,
): EquipmentRewardSystem {
  const pendingStrikes = [...strikes]
  return {
    advanceRingQueue: vi.fn(() => {
      const strike = pendingStrikes.shift()
      return strike ? [strike] : []
    }),
  } as unknown as EquipmentRewardSystem
}
