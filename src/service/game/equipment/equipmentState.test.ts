import { describe, expect, it } from 'vitest'

import { combatConfig } from '../../../configs/combatConfig'
import { equipmentConfig } from '../../../configs/equipmentConfig'
import { EquipmentState } from './equipmentState'

describe('equipment state', () => {
  it('reserves distinct slots by rarity and sends overflow to backpack', () => {
    const state = new EquipmentState()

    const [firstSword, ring, secondSword] = state.reserveDrops([
      { id: 'sword', rarity: 'N' },
      { id: 'ring', rarity: 'SR' },
      { id: 'sword', rarity: 'N' },
    ])

    expect(ring.destination).toEqual({ type: 'slot', slotIndex: 0 })
    expect(firstSword.destination).toEqual({ type: 'slot', slotIndex: 1 })
    expect(secondSword.destination).toEqual({ type: 'backpack' })
    expect(state.getEquippedCount('sword')).toBe(0)
    expect(state.getEquippedCount('ring')).toBe(0)
  })

  it('activates only completed slot reservations and keeps backpack inactive', () => {
    const state = new EquipmentState()
    const [sword, ring, storedSword] = state.reserveDrops([
      { id: 'sword', rarity: 'N' },
      { id: 'ring', rarity: 'SR' },
      { id: 'sword', rarity: 'N' },
    ])

    state.completeReservation(sword.reservationId)
    state.completeReservation(ring.reservationId)
    state.completeReservation(storedSword.reservationId)

    expect(state.getEquippedCount('sword')).toBe(1)
    expect(state.getEquippedCount('ring')).toBe(1)
    expect(state.getStoredEquipment()).toEqual(['sword'])
    expect(state.calculateWeaponDamage(combatConfig.initialWeaponDamage)).toBe(
      combatConfig.initialWeaponDamage + equipmentConfig.sword.weaponDamageBonus,
    )
  })

  it('stacks duplicate Swords additively', () => {
    const state = new EquipmentState()
    const reservations = state.reserveDrops([
      { id: 'sword', rarity: 'N' },
      { id: 'sword', rarity: 'N' },
    ])
    for (const reservation of reservations) {
      state.completeReservation(reservation.reservationId)
    }

    expect(state.calculateWeaponDamage(combatConfig.initialWeaponDamage)).toBe(
      combatConfig.initialWeaponDamage +
        equipmentConfig.sword.weaponDamageBonus * reservations.length,
    )
  })

  it('queues one delayed sequential strike per equipped Ring', () => {
    const state = new EquipmentState()
    const reservations = state.reserveDrops([
      { id: 'ring', rarity: 'SR' },
      { id: 'ring', rarity: 'SR' },
    ])
    for (const reservation of reservations) {
      state.completeReservation(reservation.reservationId)
    }
    for (
      let hitIndex = 0;
      hitIndex < equipmentConfig.ring.acceptedManualHitsPerTrigger;
      hitIndex += 1
    ) {
      state.recordAcceptedManualHit({
        targetId: 7,
        triggeringWeaponDamage: combatConfig.initialWeaponDamage,
      })
    }

    expect(
      state.advanceRingQueue(equipmentConfig.ring.additionalHitIntervalMs - 1),
    ).toEqual([])
    const [firstStrike] = state.advanceRingQueue(1)
    expect(firstStrike).toMatchObject({
      targetId: 7,
      damage:
        combatConfig.initialWeaponDamage *
        equipmentConfig.ring.additionalDamageMultiplier,
    })
    expect(state.advanceRingQueue(0)).toEqual([])
    expect(
      state.advanceRingQueue(equipmentConfig.ring.additionalHitIntervalMs),
    ).toEqual([
      expect.objectContaining({
        targetId: 7,
        batchId: firstStrike.batchId,
      }),
    ])
  })

  it('shares the Ring hit counter across targets and locks the triggering one', () => {
    const state = new EquipmentState()
    const [ring] = state.reserveDrops([{ id: 'ring', rarity: 'SR' }])
    state.completeReservation(ring.reservationId)
    for (
      let hitIndex = 1;
      hitIndex < equipmentConfig.ring.acceptedManualHitsPerTrigger;
      hitIndex += 1
    ) {
      state.recordAcceptedManualHit({
        targetId: 3,
        triggeringWeaponDamage: combatConfig.initialWeaponDamage,
      })
    }
    state.recordAcceptedManualHit({
      targetId: 4,
      triggeringWeaponDamage: combatConfig.initialWeaponDamage,
    })

    expect(
      state.advanceRingQueue(equipmentConfig.ring.additionalHitIntervalMs),
    ).toEqual([expect.objectContaining({ targetId: 4 })])
  })

  it('preserves ticker overshoot between sequential Ring strikes', () => {
    const state = new EquipmentState()
    const reservations = state.reserveDrops([
      { id: 'ring', rarity: 'SR' },
      { id: 'ring', rarity: 'SR' },
    ])
    for (const reservation of reservations) {
      state.completeReservation(reservation.reservationId)
    }
    queueRingBatch(state, 8)
    const overshootMs =
      equipmentConfig.ring.additionalHitIntervalMs / 4

    expect(
      state.advanceRingQueue(
        equipmentConfig.ring.additionalHitIntervalMs + overshootMs,
      ),
    ).toHaveLength(1)
    expect(
      state.advanceRingQueue(
        equipmentConfig.ring.additionalHitIntervalMs - overshootMs,
      ),
    ).toHaveLength(1)
  })

  it('does not settle a Ring strike exactly on an excluded round endpoint', () => {
    const state = new EquipmentState()
    const [ring] = state.reserveDrops([{ id: 'ring', rarity: 'SR' }])
    state.completeReservation(ring.reservationId)
    queueRingBatch(state, 8)

    expect(
      state.advanceRingQueue(
        equipmentConfig.ring.additionalHitIntervalMs,
        false,
      ),
    ).toEqual([])
  })

  it('cancels only the invalid target batch and clears all round state', () => {
    const state = new EquipmentState()
    const [ring] = state.reserveDrops([{ id: 'ring', rarity: 'SR' }])
    state.completeReservation(ring.reservationId)

    queueRingBatch(state, 3)
    queueRingBatch(state, 4)
    const [firstStrike] = state.advanceRingQueue(
      equipmentConfig.ring.additionalHitIntervalMs,
    )
    state.cancelRingBatch(firstStrike.batchId)

    expect(
      state.advanceRingQueue(equipmentConfig.ring.additionalHitIntervalMs),
    ).toEqual([expect.objectContaining({ targetId: 4 })])

    state.clear()
    expect(state.getEquippedCount('ring')).toBe(0)
    expect(state.getStoredEquipment()).toEqual([])
    expect(
      state.advanceRingQueue(equipmentConfig.ring.additionalHitIntervalMs),
    ).toEqual([])
  })
})

function queueRingBatch(state: EquipmentState, targetId: number): void {
  for (
    let hitIndex = 0;
    hitIndex < equipmentConfig.ring.acceptedManualHitsPerTrigger;
    hitIndex += 1
  ) {
    state.recordAcceptedManualHit({
      targetId,
      triggeringWeaponDamage: combatConfig.initialWeaponDamage,
    })
  }
}
