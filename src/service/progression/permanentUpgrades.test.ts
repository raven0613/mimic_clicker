import { describe, expect, it } from 'vitest'

import { permanentUpgradeConfig } from '../../configs/permanentUpgradeConfig'
import { equipmentConfig } from '../../configs/equipmentConfig'
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
      weaponDamage: permanentUpgradeConfig.weaponDamage.damageByLevel[0],
      hoverAutoAttack: {
        isUnlocked: false,
        intervalMs:
          permanentUpgradeConfig.hoverAutoAttack.intervalMsByLevel[0],
      },
      equipmentSlotCount: equipmentConfig.initialSlotCount,
    })
  })

  it('purchases one weapon level without mutating the previous progress', () => {
    const initial = {
      ...createInitialProgress(),
      gold: permanentUpgradeConfig.weaponDamage.costGoldByLevel[0],
    }

    const result = purchasePermanentUpgrade(initial, 'weaponDamage')

    expect(result.status).toBe('purchased')
    expect(result.progress.gold).toBe(0)
    expect(result.progress.permanentUpgrades.weaponDamage).toBe(1)
    expect(initial.permanentUpgrades.weaponDamage).toBe(0)
  })

  it('keeps progress unchanged when gold is insufficient', () => {
    const initial = createInitialProgress()

    const result = purchasePermanentUpgrade(initial, 'weaponDamage')

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
      level < permanentUpgradeConfig.weaponDamage.costGoldByLevel.length;
      level += 1
    ) {
      progress = purchasePermanentUpgrade(progress, 'weaponDamage').progress
    }

    expect(purchasePermanentUpgrade(progress, 'weaponDamage')).toEqual({
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
      permanentUpgradeConfig.weaponDamage.costGoldByLevel[0],
      permanentUpgradeConfig.hoverAutoAttack.unlockCostGold,
      permanentUpgradeConfig.equipmentSlots.costGoldByLevel[0],
    ])
    expect(initialOffers[0]).toMatchObject({
      currentValue: permanentUpgradeConfig.weaponDamage.damageByLevel[0],
      nextValue: permanentUpgradeConfig.weaponDamage.damageByLevel[1],
    })

    const unlocked = purchasePermanentUpgrade(
      progress,
      'hoverAutoAttackUnlock',
    ).progress
    expect(getPermanentUpgradeShopOffers(unlocked)[1]).toMatchObject({
      purchaseId: 'hoverAutoAttackInterval',
      currentValue:
        permanentUpgradeConfig.hoverAutoAttack.intervalMsByLevel[0],
      nextValue: permanentUpgradeConfig.hoverAutoAttack.intervalMsByLevel[1],
      costGold:
        permanentUpgradeConfig.hoverAutoAttack.intervalCostGoldByLevel[0],
    })
  })
})
