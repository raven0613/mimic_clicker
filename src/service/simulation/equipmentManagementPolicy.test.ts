import { describe, expect, it } from 'vitest'

import { equipmentDefinitions } from '../../configs/equipmentConfig'
import { EquipmentState } from '../game/equipment/equipmentState'
import { applyEquipmentManagementPolicy } from './equipmentManagementPolicy'

describe('equipment management policy', () => {
  it('replaces a lower-priority equipped card with a preferred stored card', () => {
    const state = createState('ring', 'sword')

    const switchCount = applyEquipmentManagementPolicy(state, 'swordPriority')

    expect(switchCount).toBe(1)
    expect(state.getEquippedCount('sword')).toBe(1)
    expect(state.getInventorySnapshot().stored.map(({ id }) => id)).toEqual([
      'ring',
    ])
  })

  it('leaves the same inventory untouched for no-switching and Ring priority', () => {
    for (const policy of ['noSwitching', 'ringPriority'] as const) {
      const state = createState('ring', 'sword')

      expect(applyEquipmentManagementPolicy(state, policy)).toBe(0)
      expect(state.getEquippedCount('ring')).toBe(1)
      expect(state.getInventorySnapshot().stored.map(({ id }) => id)).toEqual([
        'sword',
      ])
    }
  })

  it('preserves every acquired instance and its settlement value after switching', () => {
    const state = createState('ring', 'sword')
    const before = state.getSettlementEquipmentSnapshot().sort()

    applyEquipmentManagementPolicy(state, 'swordPriority')

    expect(state.getSettlementEquipmentSnapshot().sort()).toEqual(before)
  })
})

function createState(equippedId: 'sword' | 'ring', storedId: 'sword' | 'ring') {
  const state = new EquipmentState(1)
  for (const id of [equippedId, storedId]) {
    const definition = equipmentDefinitions.find((item) => item.id === id)
    if (!definition) throw new Error(`Missing equipment definition ${id}`)
    const [reservation] = state.reserveDrops([
      { id: definition.id, rarity: definition.rarity },
    ])
    state.completeReservation(reservation.reservationId)
  }
  return state
}
