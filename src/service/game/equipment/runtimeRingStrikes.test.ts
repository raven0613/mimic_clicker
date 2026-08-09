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
        batchId: 3,
        targetId: target.runtimeId,
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

  it('cancels the remaining batch when its runtime identity is gone', () => {
    const equipment = createEquipmentStub([
      {
        batchId: 4,
        targetId: 99,
        damage: combatConfig.initialWeaponDamage,
      },
    ])

    resolveRuntimeRingStrikes({
      equipment,
      deltaMs: equipmentConfig.ring.additionalHitIntervalMs,
      entities: [],
      damageTarget: vi.fn(() => false),
      addHitEffect: vi.fn(),
    })

    expect(equipment.cancelRingBatch).toHaveBeenCalledWith(4)
  })

  it('cancels the remaining batch immediately after a lethal strike', () => {
    const target = {
      runtimeId: 8,
      logicalX: 100,
      logicalY: 200,
    } as RuntimeMimicEntity
    const entities = [target]
    const equipment = createEquipmentStub([
      {
        batchId: 5,
        targetId: target.runtimeId,
        damage: combatConfig.initialWeaponDamage,
      },
    ])

    resolveRuntimeRingStrikes({
      equipment,
      deltaMs: equipmentConfig.ring.additionalHitIntervalMs,
      entities,
      damageTarget: vi.fn(() => {
        entities.splice(0, 1)
        return true
      }),
      addHitEffect: vi.fn(),
    })

    expect(equipment.cancelRingBatch).toHaveBeenCalledWith(5)
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
  return {
    advanceRingQueue: vi.fn(() => strikes),
    cancelRingBatch: vi.fn(),
  } as unknown as EquipmentRewardSystem
}
