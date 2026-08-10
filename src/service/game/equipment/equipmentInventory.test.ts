import { describe, expect, it } from 'vitest'

import { sortEquipmentInstances } from './equipmentInventory'
import type { EquipmentInstance } from './equipmentState'

const instances: EquipmentInstance[] = [
  { instanceId: 1, acquiredSequence: 1, id: 'ring', rarity: 'SR' },
  { instanceId: 2, acquiredSequence: 3, id: 'sword', rarity: 'N' },
  { instanceId: 3, acquiredSequence: 2, id: 'ring', rarity: 'SR' },
]

describe('equipment inventory sorting', () => {
  it('sorts acquisition mode from newest to oldest without mutating state', () => {
    const original = [...instances]

    expect(
      sortEquipmentInstances(instances, 'acquiredNewest').map(
        ({ instanceId }) => instanceId,
      ),
    ).toEqual([2, 3, 1])
    expect(instances).toEqual(original)
  })

  it('sorts rarity from highest to lowest and breaks ties by newest', () => {
    expect(
      sortEquipmentInstances(instances, 'rarityHighest').map(
        ({ instanceId }) => instanceId,
      ),
    ).toEqual([3, 1, 2])
  })
})
