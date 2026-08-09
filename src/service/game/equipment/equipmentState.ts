import type { AttachedCardRarity } from '../../../configs/attachedCardConfig'
import {
  equipmentConfig,
  type EquipmentId,
} from '../../../configs/equipmentConfig'

export interface EquipmentDrop {
  id: EquipmentId
  rarity: AttachedCardRarity
}

export type EquipmentDestination =
  | { type: 'slot'; slotIndex: number }
  | { type: 'backpack' }

export interface EquipmentReservation extends EquipmentDrop {
  reservationId: number
  destination: EquipmentDestination
}

export interface AcceptedManualHit {
  targetId: number
  triggeringWeaponDamage: number
}

export interface RingStrike {
  batchId: number
  targetId: number
  damage: number
}

type EquipmentSlot =
  | { status: 'empty' }
  | { status: 'reserved'; reservationId: number }
  | { status: 'equipped'; id: EquipmentId }

const rarityPriority: Record<AttachedCardRarity, number> = {
  N: 0,
  R: 1,
  SR: 2,
  SSR: 3,
  UR: 4,
}

export class EquipmentState {
  private readonly slots: EquipmentSlot[]
  private readonly reservations = new Map<number, EquipmentReservation>()
  private readonly storedEquipment: EquipmentId[] = []
  private readonly pendingRingStrikes: RingStrike[] = []
  private nextReservationId = 1
  private nextRingBatchId = 1
  private acceptedManualHitCount = 0
  private ringTimeUntilNextStrikeMs: number | null = null

  public constructor(slotCount = equipmentConfig.initialSlotCount) {
    if (!Number.isInteger(slotCount) || slotCount < 0) {
      throw new Error(
        `Equipment slot count must be a non-negative integer, received ${slotCount}`,
      )
    }
    this.slots = Array.from({ length: slotCount }, () => ({ status: 'empty' }))
  }

  public reserveDrops(
    drops: readonly EquipmentDrop[],
  ): EquipmentReservation[] {
    const destinations = new Map<number, EquipmentDestination>()
    const reservationIds = drops.map(() => {
      const reservationId = this.nextReservationId
      this.nextReservationId += 1
      return reservationId
    })
    const prioritizedDrops = drops
      .map((drop, index) => ({ drop, index }))
      .sort(
        (first, second) =>
          rarityPriority[second.drop.rarity] -
            rarityPriority[first.drop.rarity] || first.index - second.index,
      )

    for (const { index } of prioritizedDrops) {
      const slotIndex = this.slots.findIndex(
        (slot) => slot.status === 'empty',
      )
      destinations.set(
        index,
        slotIndex >= 0 ? { type: 'slot', slotIndex } : { type: 'backpack' },
      )
      if (slotIndex >= 0) {
        this.slots[slotIndex] = {
          status: 'reserved',
          reservationId: reservationIds[index],
        }
      }
    }

    return drops.map((drop, index) => {
      const reservationId = reservationIds[index]
      const destination = destinations.get(index)
      if (!destination) {
        throw new Error(`Missing equipment destination for drop index ${index}`)
      }
      const reservation = { ...drop, reservationId, destination }
      this.reservations.set(reservationId, reservation)
      return reservation
    })
  }

  public completeReservation(reservationId: number): void {
    const reservation = this.reservations.get(reservationId)
    if (!reservation) return

    if (reservation.destination.type === 'slot') {
      const { slotIndex } = reservation.destination
      const slot = this.slots[slotIndex]
      if (slot.status !== 'reserved' || slot.reservationId !== reservationId) {
        throw new Error(
          `Equipment slot ${slotIndex} does not hold reservation ${reservationId}`,
        )
      }
      this.slots[slotIndex] = { status: 'equipped', id: reservation.id }
    } else {
      this.storedEquipment.push(reservation.id)
    }
    this.reservations.delete(reservationId)
  }

  public cancelReservation(reservationId: number): void {
    const reservation = this.reservations.get(reservationId)
    if (!reservation) return
    if (reservation.destination.type === 'slot') {
      const slot = this.slots[reservation.destination.slotIndex]
      if (slot.status === 'reserved' && slot.reservationId === reservationId) {
        this.slots[reservation.destination.slotIndex] = { status: 'empty' }
      }
    }
    this.reservations.delete(reservationId)
  }

  public getEquippedCount(id: EquipmentId): number {
    return this.slots.filter(
      (slot) => slot.status === 'equipped' && slot.id === id,
    ).length
  }

  public getStoredEquipment(): EquipmentId[] {
    return [...this.storedEquipment]
  }

  public calculateWeaponDamage(baseDamage: number): number {
    return (
      baseDamage +
      this.getEquippedCount('sword') * equipmentConfig.sword.weaponDamageBonus
    )
  }

  public recordAcceptedManualHit(hit: AcceptedManualHit): void {
    const ringCount = this.getEquippedCount('ring')
    if (ringCount === 0) return

    this.acceptedManualHitCount += 1
    if (
      this.acceptedManualHitCount <
      equipmentConfig.ring.acceptedManualHitsPerTrigger
    ) {
      return
    }

    this.acceptedManualHitCount = 0
    const batchId = this.nextRingBatchId
    this.nextRingBatchId += 1
    const damage =
      hit.triggeringWeaponDamage *
      equipmentConfig.ring.additionalDamageMultiplier
    for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
      this.pendingRingStrikes.push({
        batchId,
        targetId: hit.targetId,
        damage,
      })
    }
    if (this.ringTimeUntilNextStrikeMs === null) {
      this.ringTimeUntilNextStrikeMs =
        equipmentConfig.ring.additionalHitIntervalMs
    }
  }

  public advanceRingQueue(
    deltaMs: number,
    includeEndpoint = true,
  ): RingStrike[] {
    if (
      this.pendingRingStrikes.length === 0 ||
      this.ringTimeUntilNextStrikeMs === null
    ) {
      return []
    }

    this.ringTimeUntilNextStrikeMs -= Math.max(0, deltaMs)
    if (
      this.ringTimeUntilNextStrikeMs > 0 ||
      (!includeEndpoint && this.ringTimeUntilNextStrikeMs === 0)
    ) {
      return []
    }

    const overshootMs = this.ringTimeUntilNextStrikeMs
    const strike = this.pendingRingStrikes.shift()
    this.ringTimeUntilNextStrikeMs =
      this.pendingRingStrikes.length > 0
        ? equipmentConfig.ring.additionalHitIntervalMs + overshootMs
        : null
    return strike ? [strike] : []
  }

  public cancelRingBatch(batchId: number): void {
    for (let index = this.pendingRingStrikes.length - 1; index >= 0; index -= 1) {
      if (this.pendingRingStrikes[index].batchId === batchId) {
        this.pendingRingStrikes.splice(index, 1)
      }
    }
    if (this.pendingRingStrikes.length === 0) {
      this.ringTimeUntilNextStrikeMs = null
    }
  }

  public clear(): void {
    this.reservations.clear()
    this.storedEquipment.length = 0
    this.pendingRingStrikes.length = 0
    this.acceptedManualHitCount = 0
    this.ringTimeUntilNextStrikeMs = null
    this.nextReservationId = 1
    this.nextRingBatchId = 1
    for (let index = 0; index < this.slots.length; index += 1) {
      this.slots[index] = { status: 'empty' }
    }
  }
}
