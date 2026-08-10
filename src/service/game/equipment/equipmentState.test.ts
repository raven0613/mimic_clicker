import { describe, expect, it } from 'vitest'

import { combatConfig } from '../../../configs/combatConfig'
import { equipmentConfig } from '../../../configs/equipmentConfig'
import { EquipmentState } from './equipmentState'

describe('equipment state', () => {
  it('uses the same reservation flow for a permanently unlocked third slot', () => {
    const state = new EquipmentState(equipmentConfig.initialSlotCount + 1)

    const reservations = state.reserveDrops([
      { id: 'sword', rarity: 'N' },
      { id: 'ring', rarity: 'SR' },
      { id: 'sword', rarity: 'N' },
      { id: 'ring', rarity: 'SR' },
    ])

    expect(
      reservations.filter(({ destination }) => destination.type === 'slot'),
    ).toHaveLength(equipmentConfig.initialSlotCount + 1)
    expect(
      reservations.filter(({ destination }) => destination.type === 'backpack'),
    ).toHaveLength(1)
  })

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

  it('activates only completed slot reservations and keeps stored effects inactive', () => {
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
    expect(state.getInventorySnapshot().stored.map(({ id }) => id)).toEqual([
      'sword',
    ])
    expect(state.calculateWeaponDamage(combatConfig.initialWeaponDamage)).toBe(
      combatConfig.initialWeaponDamage + equipmentConfig.sword.weaponDamageBonus,
    )
  })

  it('snapshots pending, equipped, and stored successful drops exactly once', () => {
    const state = new EquipmentState(1)
    const [ring] = state.reserveDrops([{ id: 'ring', rarity: 'SR' }])
    state.completeReservation(ring.reservationId)
    const [storedSword] = state.reserveDrops([{ id: 'sword', rarity: 'N' }])
    state.completeReservation(storedSword.reservationId)
    state.reserveDrops([{ id: 'sword', rarity: 'N' }])

    expect(state.getSettlementEquipmentSnapshot()).toEqual([
      'ring',
      'sword',
      'sword',
    ])
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
        targetPosition: { x: 100, y: 200 },
        triggeringWeaponDamage: combatConfig.initialWeaponDamage,
      })
    }

    expect(
      state.advanceRingQueue(equipmentConfig.ring.additionalHitIntervalMs - 1),
    ).toEqual([])
    const [firstStrike] = state.advanceRingQueue(1)
    expect(firstStrike).toMatchObject({
      targetId: 7,
      targetPosition: { x: 100, y: 200 },
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
        targetPosition: { x: 100, y: 200 },
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
        targetPosition: { x: 30, y: 40 },
        triggeringWeaponDamage: combatConfig.initialWeaponDamage,
      })
    }
    state.recordAcceptedManualHit({
      targetId: 4,
      targetPosition: { x: 50, y: 60 },
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

  it('clears all pending Ring strikes with the round state', () => {
    const state = new EquipmentState()
    const [ring] = state.reserveDrops([{ id: 'ring', rarity: 'SR' }])
    state.completeReservation(ring.reservationId)

    queueRingBatch(state, 3)
    state.clear()
    expect(state.getEquippedCount('ring')).toBe(0)
    expect(state.getInventorySnapshot().stored).toEqual([])
    expect(
      state.advanceRingQueue(equipmentConfig.ring.additionalHitIntervalMs),
    ).toEqual([])
  })

  it('atomically replaces an occupied slot and preserves instance acquisition order', () => {
    const state = new EquipmentState(1)
    const [equippedRing] = state.reserveDrops([{ id: 'ring', rarity: 'SR' }])
    state.completeReservation(equippedRing.reservationId)
    const [storedSword] = state.reserveDrops([{ id: 'sword', rarity: 'N' }])
    state.completeReservation(storedSword.reservationId)

    expect(
      state.moveEquipment({
        instanceId: storedSword.instanceId,
        destination: { type: 'slot', slotIndex: 0 },
      }),
    ).toEqual({ status: 'moved' })

    const snapshot = state.getInventorySnapshot()
    expect(snapshot.slots[0]).toMatchObject({
      status: 'equipped',
      instance: { instanceId: storedSword.instanceId, id: 'sword' },
    })
    expect(snapshot.stored).toEqual([
      expect.objectContaining({
        instanceId: equippedRing.instanceId,
        acquiredSequence: equippedRing.acquiredSequence,
      }),
    ])
    expect(state.getSettlementEquipmentSnapshot()).toEqual(['sword', 'ring'])
  })

  it('moves equipped instances between slots and back to the backpack', () => {
    const state = new EquipmentState(2)
    const [sword, ring] = state.reserveDrops([
      { id: 'sword', rarity: 'N' },
      { id: 'ring', rarity: 'SR' },
    ])
    state.completeReservation(sword.reservationId)
    state.completeReservation(ring.reservationId)

    expect(
      state.moveEquipment({
        instanceId: sword.instanceId,
        destination: { type: 'slot', slotIndex: 0 },
      }),
    ).toEqual({ status: 'moved' })
    expect(state.getInventorySnapshot().slots).toEqual([
      expect.objectContaining({
        status: 'equipped',
        instance: expect.objectContaining({ instanceId: sword.instanceId }),
      }),
      expect.objectContaining({
        status: 'equipped',
        instance: expect.objectContaining({ instanceId: ring.instanceId }),
      }),
    ])

    expect(
      state.moveEquipment({
        instanceId: sword.instanceId,
        destination: { type: 'backpack' },
      }),
    ).toEqual({ status: 'moved' })
    expect(state.getInventorySnapshot().stored).toEqual([
      expect.objectContaining({ instanceId: sword.instanceId }),
    ])
  })

  it('rejects a reserved destination without partially changing equipment', () => {
    const state = new EquipmentState(2)
    const [reservedRing] = state.reserveDrops([{ id: 'ring', rarity: 'SR' }])
    const [equippedSword] = state.reserveDrops([{ id: 'sword', rarity: 'N' }])
    state.completeReservation(equippedSword.reservationId)
    const before = state.getInventorySnapshot()

    expect(
      state.moveEquipment({
        instanceId: equippedSword.instanceId,
        destination: {
          type: 'slot',
          slotIndex:
            reservedRing.destination.type === 'slot'
              ? reservedRing.destination.slotIndex
              : -1,
        },
      }),
    ).toEqual({ status: 'rejected', reason: 'destinationReserved' })
    expect(state.getInventorySnapshot()).toEqual(before)
  })

  it('resets partial Ring progress only after the final equipped Ring is removed', () => {
    const state = new EquipmentState(2)
    const [firstRing, secondRing] = state.reserveDrops([
      { id: 'ring', rarity: 'SR' },
      { id: 'ring', rarity: 'SR' },
    ])
    state.completeReservation(firstRing.reservationId)
    state.completeReservation(secondRing.reservationId)
    recordRingHits(
      state,
      equipmentConfig.ring.acceptedManualHitsPerTrigger - 1,
      11,
    )

    state.moveEquipment({
      instanceId: firstRing.instanceId,
      destination: { type: 'backpack' },
    })
    recordRingHits(state, 1, 11)
    expect(
      state.advanceRingQueue(equipmentConfig.ring.additionalHitIntervalMs),
    ).toHaveLength(1)

    state.moveEquipment({
      instanceId: secondRing.instanceId,
      destination: { type: 'backpack' },
    })
    state.moveEquipment({
      instanceId: firstRing.instanceId,
      destination: { type: 'slot', slotIndex: 0 },
    })
    recordRingHits(state, 1, 12)
    expect(
      state.advanceRingQueue(equipmentConfig.ring.additionalHitIntervalMs),
    ).toEqual([])
  })

  it('keeps queued Ring strikes unchanged when the equipped Rings change', () => {
    const state = new EquipmentState(2)
    const [firstRing, secondRing] = state.reserveDrops([
      { id: 'ring', rarity: 'SR' },
      { id: 'ring', rarity: 'SR' },
    ])
    state.completeReservation(firstRing.reservationId)
    state.completeReservation(secondRing.reservationId)
    queueRingBatch(state, 13)

    state.moveEquipment({
      instanceId: firstRing.instanceId,
      destination: { type: 'backpack' },
    })
    state.moveEquipment({
      instanceId: secondRing.instanceId,
      destination: { type: 'backpack' },
    })

    expect(
      state.advanceRingQueue(equipmentConfig.ring.additionalHitIntervalMs),
    ).toHaveLength(1)
    expect(
      state.advanceRingQueue(equipmentConfig.ring.additionalHitIntervalMs),
    ).toHaveLength(1)
  })
})

function queueRingBatch(state: EquipmentState, targetId: number): void {
  recordRingHits(
    state,
    equipmentConfig.ring.acceptedManualHitsPerTrigger,
    targetId,
  )
}

function recordRingHits(
  state: EquipmentState,
  count: number,
  targetId: number,
): void {
  for (
    let hitIndex = 0;
    hitIndex < count;
    hitIndex += 1
  ) {
    state.recordAcceptedManualHit({
      targetId,
      targetPosition: { x: targetId * 10, y: targetId * 20 },
      triggeringWeaponDamage: combatConfig.initialWeaponDamage,
    })
  }
}
