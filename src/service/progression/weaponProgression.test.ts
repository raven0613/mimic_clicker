import { describe, expect, it } from 'vitest'

import { balanceSimulationConfig } from '../../configs/balanceSimulationConfig'
import { mimicConfigs } from '../../configs/mimicConfigs'
import { weaponConfig, type WeaponId } from '../../configs/weaponConfig'
import { createInitialProgress } from './createInitialProgress'
import {
  createRoundProgressionSnapshot,
  equipWeapon,
  getWeaponShopOffers,
  purchaseWeapon,
} from './weaponProgression'

describe('weapon progression', () => {
  it('defines a valid acyclic weapon progression from config', () => {
    const definitions = weaponConfig.definitions
    const ids = definitions.map(({ id }) => id)

    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain(weaponConfig.initialWeaponId)
    for (const definition of definitions) {
      expect(Number.isInteger(definition.baseDamage)).toBe(true)
      expect(definition.baseDamage).toBeGreaterThan(0)
      expect(Number.isInteger(definition.priceGold)).toBe(true)
      expect(definition.priceGold).toBeGreaterThanOrEqual(0)
      if (definition.id === weaponConfig.initialWeaponId) {
        expect(definition.priceGold).toBe(0)
        expect(definition.requiredWeaponId).toBeNull()
      } else {
        expect(definition.priceGold).toBeGreaterThan(0)
        expect(ids).toContain(definition.requiredWeaponId)
      }
      expect(requirementChain(definition.id)).not.toContain(definition.id)
    }
  })

  it('creates every shop offer while preserving prerequisites', () => {
    const progress = createInitialProgress()

    const offers = getWeaponShopOffers(progress)

    expect(offers).toHaveLength(weaponConfig.definitions.length)
    expect(offers.map(({ definition }) => definition)).toEqual(
      weaponConfig.definitions,
    )
    expect(offers[0].availability).toBe('equipped')
    expect(offers[1].availability).toBe('insufficientGold')
    expect(offers[2].availability).toBe('prerequisiteNotMet')
  })

  it('rejects invalid purchases without changing progress', () => {
    const initial = createInitialProgress()
    const secondWeapon = weaponConfig.definitions[1]
    const thirdWeapon = weaponConfig.definitions[2]

    expect(purchaseWeapon(initial, secondWeapon.id)).toEqual({
      status: 'insufficientGold',
      progress: initial,
    })
    expect(
      purchaseWeapon(
        { ...initial, gold: Number.MAX_SAFE_INTEGER },
        thirdWeapon.id,
      ),
    ).toEqual({ status: 'prerequisiteNotMet', progress: {
      ...initial,
      gold: Number.MAX_SAFE_INTEGER,
    } })
    expect(purchaseWeapon(initial, weaponConfig.initialWeaponId)).toEqual({
      status: 'alreadyOwned',
      progress: initial,
    })
    expect(purchaseWeapon(initial, 'missingWeapon')).toEqual({
      status: 'unknownWeapon',
      progress: initial,
    })
  })

  it('atomically buys and equips a weapon using its formal config price', () => {
    const definition = weaponConfig.definitions[1]
    const initial = {
      ...createInitialProgress(),
      gold: definition.priceGold,
    }

    const result = purchaseWeapon(initial, definition.id)

    expect(result.status).toBe('purchased')
    expect(result.progress.gold).toBe(initial.gold - definition.priceGold)
    expect(result.progress.ownedWeaponIds).toEqual([
      weaponConfig.initialWeaponId,
      definition.id,
    ])
    expect(result.progress.equippedWeaponId).toBe(definition.id)
  })

  it('only equips owned weapons and can switch back for free', () => {
    const definition = weaponConfig.definitions[1]
    const initial = createInitialProgress()

    expect(equipWeapon(initial, definition.id)).toEqual({
      status: 'notOwned',
      progress: initial,
    })
    const purchased = purchaseWeapon(
      { ...initial, gold: definition.priceGold },
      definition.id,
    ).progress
    const switched = equipWeapon(purchased, weaponConfig.initialWeaponId)

    expect(switched.status).toBe('equipped')
    expect(switched.progress.gold).toBe(purchased.gold)
    expect(switched.progress.equippedWeaponId).toBe(
      weaponConfig.initialWeaponId,
    )
  })

  it('creates an immutable round snapshot from the equipped weapon', () => {
    const definition = weaponConfig.definitions[1]
    const progress = purchaseWeapon(
      { ...createInitialProgress(), gold: definition.priceGold },
      definition.id,
    ).progress

    const snapshot = createRoundProgressionSnapshot(progress)
    const switched = equipWeapon(progress, weaponConfig.initialWeaponId)

    expect(snapshot.weapon).toEqual({
      id: definition.id,
      baseDamage: definition.baseDamage,
    })
    expect(switched.progress.equippedWeaponId).toBe(
      weaponConfig.initialWeaponId,
    )
    expect(snapshot.weapon.id).toBe(definition.id)
  })

  it('meets every configured weapon hit-count milestone', () => {
    for (const milestone of balanceSimulationConfig.targets.weapons
      .hitCountMilestones) {
      const maximumHealth = mimicConfigs[milestone.mimicId].maximumHealth
      const oldWeapon = definitionById(milestone.oldWeaponId)
      const newWeapon = definitionById(milestone.newWeaponId)

      expect(Math.ceil(maximumHealth / oldWeapon.baseDamage)).toBe(
        milestone.oldWeaponHitCount,
      )
      expect(Math.ceil(maximumHealth / newWeapon.baseDamage)).toBe(
        milestone.newWeaponHitCount,
      )
    }
  })
})

function definitionById(id: WeaponId) {
  const definition = weaponConfig.definitions.find((candidate) => candidate.id === id)
  if (!definition) throw new Error(`Missing test weapon definition: ${id}`)
  return definition
}

function requirementChain(id: WeaponId): WeaponId[] {
  const chain: WeaponId[] = []
  let requiredId = definitionById(id).requiredWeaponId
  while (requiredId !== null) {
    chain.push(requiredId)
    requiredId = definitionById(requiredId).requiredWeaponId
    if (chain.length > weaponConfig.definitions.length) break
  }
  return chain
}
