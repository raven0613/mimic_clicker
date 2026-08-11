import { describe, expect, it } from 'vitest'

import { combatConfig } from '../../configs/combatConfig'
import { equipmentConfig } from '../../configs/equipmentConfig'
import { permanentUpgradeConfig } from '../../configs/permanentUpgradeConfig'
import { createInitialProgress } from './createInitialProgress'
import {
  createPermanentUpgradeSnapshot,
  getPermanentUpgradeShopOffers,
  purchasePermanentUpgrade,
  resolveEquipmentSlotCount,
} from './permanentUpgrades'

describe('permanent upgrades', () => {
  it('resolves the unupgraded round snapshot from config', () => {
    const progress = createInitialProgress()

    expect(createPermanentUpgradeSnapshot(progress.permanentUpgrades)).toEqual({
      weaponDamage: combatConfig.initialWeaponDamage,
      hoverAutoAttack: {
        isUnlocked: false,
        intervalMs:
          permanentUpgradeConfig.hoverAutoAttack.intervalMsByLevel[0],
      },
      equipmentSlotCount: equipmentConfig.initialSlotCount,
    })
  })

  it('keeps progress unchanged when gold is insufficient', () => {
    const initial = createInitialProgress()

    const result = purchasePermanentUpgrade(initial, 'hoverAutoAttackUnlock')

    expect(result).toEqual({ status: 'insufficientGold', progress: initial })
  })

  it('requires hover attack unlock before buying interval levels', () => {
    const initial = {
      ...createInitialProgress(),
      gold: Number.MAX_SAFE_INTEGER,
    }

    const blocked = purchasePermanentUpgrade(
      initial,
      'hoverAutoAttackInterval',
    )
    const unlocked = purchasePermanentUpgrade(initial, 'hoverAutoAttackUnlock')
    const upgraded = purchasePermanentUpgrade(
      unlocked.progress,
      'hoverAutoAttackInterval',
    )

    expect(blocked.status).toBe('prerequisiteNotMet')
    expect(unlocked.status).toBe('purchased')
    expect(upgraded.status).toBe('purchased')
    expect(upgraded.progress.permanentUpgrades.hoverAutoAttackInterval).toBe(1)
  })

  it('rejects purchases after the configured maximum level', () => {
    let progress = {
      ...createInitialProgress(),
      gold: Number.MAX_SAFE_INTEGER,
    }
    for (
      let level = 0;
      level < permanentUpgradeConfig.hoverAutoAttack.intervalCostGoldByLevel.length;
      level += 1
    ) {
      if (level === 0) {
        progress = purchasePermanentUpgrade(
          progress,
          'hoverAutoAttackUnlock',
        ).progress
      }
      progress = purchasePermanentUpgrade(
        progress,
        'hoverAutoAttackInterval',
      ).progress
    }

    expect(
      purchasePermanentUpgrade(progress, 'hoverAutoAttackInterval'),
    ).toEqual({
      status: 'maximumLevel',
      progress,
    })
  })

  it('extends the same slot resolver to a future fourth slot', () => {
    expect(resolveEquipmentSlotCount(0, [0, 1, 2])).toBe(
      equipmentConfig.initialSlotCount,
    )
    expect(resolveEquipmentSlotCount(1, [0, 1, 2])).toBe(
      equipmentConfig.initialSlotCount + 1,
    )
    expect(resolveEquipmentSlotCount(2, [0, 1, 2])).toBe(
      equipmentConfig.initialSlotCount + 2,
    )
  })

  it('provides every shop price and next effect from the formal config', () => {
    const progress = {
      ...createInitialProgress(),
      gold: Number.MAX_SAFE_INTEGER,
    }
    const initialOffers = getPermanentUpgradeShopOffers(progress)

    expect(initialOffers.map(({ costGold }) => costGold)).toEqual([
      permanentUpgradeConfig.hoverAutoAttack.unlockCostGold,
      permanentUpgradeConfig.equipmentSlots.costGoldByLevel[0],
    ])
    expect(initialOffers[0]).toMatchObject({
      purchaseId: 'hoverAutoAttackUnlock',
      currentValue: false,
      nextValue: permanentUpgradeConfig.hoverAutoAttack.intervalMsByLevel[0],
    })

    const unlocked = purchasePermanentUpgrade(
      progress,
      'hoverAutoAttackUnlock',
    ).progress
    expect(getPermanentUpgradeShopOffers(unlocked)[0]).toMatchObject({
      purchaseId: 'hoverAutoAttackInterval',
      currentValue:
        permanentUpgradeConfig.hoverAutoAttack.intervalMsByLevel[0],
      nextValue: permanentUpgradeConfig.hoverAutoAttack.intervalMsByLevel[1],
      costGold:
        permanentUpgradeConfig.hoverAutoAttack.intervalCostGoldByLevel[0],
    })
  })
})
