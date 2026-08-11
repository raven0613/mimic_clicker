import 'fake-indexeddb/auto'

import { describe, expect, it } from 'vitest'

import { mimicConfigs } from '../../configs/mimicConfigs'
import type { ProgressData } from '../../types/game'
import { completeRound } from '../progression/progression'
import { createInitialProgress } from '../progression/createInitialProgress'
import { purchasePermanentUpgrade } from '../progression/permanentUpgrades'
import { permanentUpgradeConfig } from '../../configs/permanentUpgradeConfig'
import { weaponConfig } from '../../configs/weaponConfig'
import { calculateEquipmentSale } from '../settlement/equipmentSale'
import { createRoundResult } from '../settlement/roundSettlement'
import { equipWeapon, purchaseWeapon } from '../progression/weaponProgression'
import { createSaveRepository } from './saveRepository'

let databaseSequence = 0

function createRepository() {
  const databaseName = `mimic-clicker-test-${databaseSequence}`
  databaseSequence += 1
  return createSaveRepository(databaseName)
}

describe('save repository', () => {
  it('creates and persists the initial progress when no save exists', async () => {
    const repository = createRepository()

    const progress = await repository.loadOrCreate()
    const reloaded = await repository.loadOrCreate()

    expect(reloaded).toEqual(progress)
    expect(reloaded.unlockedMimicIds).toEqual(['normal'])
  })

  it('persists a completed round and its pending unlock together', async () => {
    const repository = createRepository()
    const initial = await repository.loadOrCreate()
    const result = createRoundResult({
      combatGold: mimicConfigs.normal.baseReward,
      equipmentSale: calculateEquipmentSale(['sword', 'ring']),
      defeatedMimics: 1,
      jackpotOutcome: 'escaped',
    })
    const settlement = completeRound(initial, result)

    await repository.replace(settlement.progress)

    const reloaded = await repository.loadOrCreate()
    expect(reloaded).toEqual(settlement.progress)
    expect(reloaded.latestRoundResult).toEqual(result)
    expect(reloaded.gold).toBe(initial.gold + result.totalGold)
  })

  it('resets to a new initial progress document', async () => {
    const repository = createRepository()
    const initial = await repository.loadOrCreate()
    const settlement = completeRound(initial, {
      combatGold: mimicConfigs.normal.baseReward,
      equipmentSaleGold: 0,
      totalGold: mimicConfigs.normal.baseReward,
      equipmentSales: [],
      defeatedMimics: 1,
      jackpotOutcome: 'defeated',
    })
    await repository.replace(settlement.progress)

    const reset = await repository.reset()

    expect(reset.completedRounds).toBe(0)
    expect(reset.gold).toBe(0)
    expect(reset.unlockedMimicIds).toEqual(['normal'])
    expect(reset.permanentUpgrades).toEqual(
      createInitialProgress().permanentUpgrades,
    )
  })

  it('persists a permanent upgrade and its gold deduction together', async () => {
    const repository = createRepository()
    const initial = {
      ...(await repository.loadOrCreate()),
      gold: permanentUpgradeConfig.hoverAutoAttack.unlockCostGold,
    }
    const purchase = purchasePermanentUpgrade(initial, 'hoverAutoAttackUnlock')

    expect(purchase.status).toBe('purchased')
    await repository.replace(purchase.progress)

    expect(await repository.loadOrCreate()).toEqual(purchase.progress)
  })

  it('persists weapon purchase and free equipment switching', async () => {
    const repository = createRepository()
    const definition = weaponConfig.definitions[1]
    const initial = {
      ...(await repository.loadOrCreate()),
      gold: definition.priceGold,
    }
    const purchase = purchaseWeapon(initial, definition.id)

    expect(purchase.status).toBe('purchased')
    await repository.replace(purchase.progress)
    expect(await repository.loadOrCreate()).toEqual(purchase.progress)

    const switched = equipWeapon(
      purchase.progress,
      weaponConfig.initialWeaponId,
    )
    expect(switched.status).toBe('equipped')
    await repository.replace(switched.progress)
    expect(await repository.loadOrCreate()).toEqual(switched.progress)
  })

  it('rejects progression that contradicts the fixed unlock sequence', async () => {
    const repository = createRepository()
    const initial = await repository.loadOrCreate()
    const inconsistent: ProgressData = {
      ...createInitialProgress(),
      unlockedMimicIds: ['normal', 'rare2'],
    }

    await expect(repository.replace(inconsistent)).rejects.toThrow()
    expect(await repository.loadOrCreate()).toEqual(initial)
  })
})
