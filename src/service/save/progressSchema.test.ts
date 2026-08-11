import { describe, expect, it } from 'vitest'

import { weaponConfig } from '../../configs/weaponConfig'
import { createInitialProgress } from '../progression/createInitialProgress'
import { parseProgress } from './progressSchema'

describe('progress schema migration', () => {
  it('migrates a version 1 save without inventing a completed settlement', () => {
    const current = createInitialProgress()
    const migrated = parseProgress({
      schemaVersion: 1,
      completedRounds: current.completedRounds,
      gold: current.gold,
      unlockedMimicIds: current.unlockedMimicIds,
      pendingUnlockMimicIds: current.pendingUnlockMimicIds,
    })

    expect(migrated.schemaVersion).toBe(current.schemaVersion)
    expect(migrated.latestRoundResult).toBeNull()
    expect(migrated.permanentUpgrades).toEqual(current.permanentUpgrades)
  })

  it('migrates a version 2 save with every permanent upgrade at level zero', () => {
    const current = createInitialProgress()
    const migrated = parseProgress({
      schemaVersion: 2,
      completedRounds: current.completedRounds,
      gold: current.gold,
      unlockedMimicIds: current.unlockedMimicIds,
      pendingUnlockMimicIds: current.pendingUnlockMimicIds,
      latestRoundResult: null,
    })

    expect(migrated.schemaVersion).toBe(current.schemaVersion)
    expect(migrated.permanentUpgrades).toEqual(current.permanentUpgrades)
  })

  it('migrates version 3 without refunding or retaining weapon damage levels', () => {
    const current = createInitialProgress()
    const migrated = parseProgress({
      schemaVersion: 3,
      completedRounds: current.completedRounds,
      gold: 137,
      unlockedMimicIds: current.unlockedMimicIds,
      pendingUnlockMimicIds: current.pendingUnlockMimicIds,
      latestRoundResult: current.latestRoundResult,
      permanentUpgrades: {
        weaponDamage: 3,
        hoverAutoAttackUnlock: 1,
        hoverAutoAttackInterval: 2,
        equipmentSlots: 1,
      },
    })

    expect(migrated).toEqual({
      ...current,
      gold: 137,
      permanentUpgrades: {
        hoverAutoAttackUnlock: 1,
        hoverAutoAttackInterval: 2,
        equipmentSlots: 1,
      },
    })
    expect(migrated.permanentUpgrades).not.toHaveProperty('weaponDamage')
  })

  it('migrates version 4 with only the initial weapon owned and equipped', () => {
    const current = createInitialProgress()
    const migrated = parseProgress({
      schemaVersion: 4,
      completedRounds: current.completedRounds,
      gold: current.gold,
      unlockedMimicIds: current.unlockedMimicIds,
      pendingUnlockMimicIds: current.pendingUnlockMimicIds,
      latestRoundResult: current.latestRoundResult,
      permanentUpgrades: current.permanentUpgrades,
    })

    expect(migrated.schemaVersion).toBe(current.schemaVersion)
    expect(migrated.ownedWeaponIds).toEqual([weaponConfig.initialWeaponId])
    expect(migrated.equippedWeaponId).toBe(weaponConfig.initialWeaponId)
  })

  it('rejects the removed weapon damage field in a current save', () => {
    const current = createInitialProgress()

    expect(() =>
      parseProgress({
        ...current,
        permanentUpgrades: {
          ...current.permanentUpgrades,
          weaponDamage: 0,
        },
      }),
    ).toThrow()
  })

  it('rejects an automatic interval level before hover attack is unlocked', () => {
    const current = createInitialProgress()

    expect(() =>
      parseProgress({
        ...current,
        permanentUpgrades: {
          ...current.permanentUpgrades,
          hoverAutoAttackInterval: 1,
        },
      }),
    ).toThrow()
  })

  it('rejects duplicate, unknown, missing-initial, and unowned equipped weapons', () => {
    const current = createInitialProgress()
    const secondWeaponId = weaponConfig.definitions[1].id

    for (const weaponProgress of [
      {
        ownedWeaponIds: [
          weaponConfig.initialWeaponId,
          weaponConfig.initialWeaponId,
        ],
        equippedWeaponId: weaponConfig.initialWeaponId,
      },
      {
        ownedWeaponIds: ['missingWeapon'],
        equippedWeaponId: 'missingWeapon',
      },
      {
        ownedWeaponIds: [secondWeaponId],
        equippedWeaponId: secondWeaponId,
      },
      {
        ownedWeaponIds: [weaponConfig.initialWeaponId],
        equippedWeaponId: secondWeaponId,
      },
    ]) {
      expect(() => parseProgress({ ...current, ...weaponProgress })).toThrow()
    }
  })
})
