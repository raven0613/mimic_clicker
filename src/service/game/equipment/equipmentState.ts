import type { AttachedCardRarity } from '../../../configs/attachedCardConfig'
import {
  equipmentConfig,
  type EquipmentId,
} from '../../../configs/equipmentConfig'
import type { Vector2 } from '../../../types/game'

export interface EquipmentDrop {
  id: EquipmentId
  rarity: AttachedCardRarity
}

export interface EquipmentInstance extends EquipmentDrop {
  instanceId: number
  acquiredSequence: number
}

export type EquipmentDestination =
  | { type: 'slot'; slotIndex: number }
  | { type: 'backpack' }

export interface EquipmentReservation extends EquipmentInstance {
  reservationId: number
  destination: EquipmentDestination
}

export type EquipmentSlotSnapshot =
  | { status: 'empty' }
  | { status: 'reserved'; reservationId: number }
  | { status: 'equipped'; instance: EquipmentInstance }

export interface EquipmentInventorySnapshot {
  slots: EquipmentSlotSnapshot[]
  stored: EquipmentInstance[]
}

export interface MoveEquipmentCommand {
  instanceId: number
  destination: EquipmentDestination
}

export type MoveEquipmentResult =
  | { status: 'moved' }
  | {
      status: 'rejected'
      reason:
        | 'instanceNotFound'
        | 'invalidDestination'
        | 'destinationReserved'
        | 'sameLocation'
    }

export interface AcceptedManualHit {
  targetId: number
  hitEffectOrigin: Vector2
  triggeringWeaponDamage: number
}

export interface RingStrike {
  targetId: number
  hitEffectOrigin: Vector2
  damage: number
}

type EquipmentSlot =
  | { status: 'empty' }
  | { status: 'reserved'; reservationId: number }
  | { status: 'equipped'; instance: EquipmentInstance }

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
  private readonly storedEquipment: EquipmentInstance[] = []
  private readonly pendingRingStrikes: RingStrike[] = []
  private nextReservationId = 1
  private nextInstanceId = 1
  private nextAcquiredSequence = 1
  private acceptedManualHitCount = 0
  private ringTimeUntilNextStrikeMs: number | null = null

  public constructor(slotCount: number = equipmentConfig.initialSlotCount) {
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
    const instances = drops.map((drop) => {
      const instance: EquipmentInstance = {
        ...drop,
        instanceId: this.nextInstanceId,
        acquiredSequence: this.nextAcquiredSequence,
      }
      this.nextInstanceId += 1
      this.nextAcquiredSequence += 1
      return instance
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

    return instances.map((instance, index) => {
      const reservationId = reservationIds[index]
      const destination = destinations.get(index)
      if (!destination) {
        throw new Error(`Missing equipment destination for drop index ${index}`)
      }
      const reservation = { ...instance, reservationId, destination }
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
      this.slots[slotIndex] = {
        status: 'equipped',
        instance: toEquipmentInstance(reservation),
      }
    } else {
      this.storedEquipment.push(toEquipmentInstance(reservation))
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
      (slot) => slot.status === 'equipped' && slot.instance.id === id,
    ).length
  }

  public getInventorySnapshot(): EquipmentInventorySnapshot {
    return {
      slots: this.slots.map((slot) => {
        if (slot.status !== 'equipped') return { ...slot }
        return { status: 'equipped', instance: { ...slot.instance } }
      }),
      stored: this.storedEquipment.map((instance) => ({ ...instance })),
    }
  }

  public moveEquipment(command: MoveEquipmentCommand): MoveEquipmentResult {
    const sourceSlotIndex = this.slots.findIndex(
      (slot) =>
        slot.status === 'equipped' &&
        slot.instance.instanceId === command.instanceId,
    )
    const storedIndex = this.storedEquipment.findIndex(
      ({ instanceId }) => instanceId === command.instanceId,
    )
    if (sourceSlotIndex < 0 && storedIndex < 0) {
      return { status: 'rejected', reason: 'instanceNotFound' }
    }

    const ringCountBefore = this.getEquippedCount('ring')
    if (command.destination.type === 'backpack') {
      if (storedIndex >= 0) {
        return { status: 'rejected', reason: 'sameLocation' }
      }
      const sourceSlot = this.slots[sourceSlotIndex]
      if (sourceSlot.status !== 'equipped') {
        return { status: 'rejected', reason: 'instanceNotFound' }
      }
      this.storedEquipment.push(sourceSlot.instance)
      this.slots[sourceSlotIndex] = { status: 'empty' }
      this.resetRingProgressAfterMove(ringCountBefore)
      return { status: 'moved' }
    }

    const { slotIndex } = command.destination
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= this.slots.length) {
      return { status: 'rejected', reason: 'invalidDestination' }
    }
    if (slotIndex === sourceSlotIndex) {
      return { status: 'rejected', reason: 'sameLocation' }
    }
    const destinationSlot = this.slots[slotIndex]
    if (destinationSlot.status === 'reserved') {
      return { status: 'rejected', reason: 'destinationReserved' }
    }

    if (storedIndex >= 0) {
      const [sourceInstance] = this.storedEquipment.splice(storedIndex, 1)
      if (destinationSlot.status === 'equipped') {
        this.storedEquipment.push(destinationSlot.instance)
      }
      this.slots[slotIndex] = { status: 'equipped', instance: sourceInstance }
    } else {
      const sourceSlot = this.slots[sourceSlotIndex]
      if (sourceSlot.status !== 'equipped') {
        return { status: 'rejected', reason: 'instanceNotFound' }
      }
      this.slots[slotIndex] = sourceSlot
      this.slots[sourceSlotIndex] =
        destinationSlot.status === 'equipped'
          ? destinationSlot
          : { status: 'empty' }
    }
    this.resetRingProgressAfterMove(ringCountBefore)
    return { status: 'moved' }
  }

  public getSettlementEquipmentSnapshot(): EquipmentId[] {
    const equipped = this.slots.flatMap((slot) =>
      slot.status === 'equipped' ? [slot.instance.id] : [],
    )
    const pending = [...this.reservations.values()].map(
      (reservation) => reservation.id,
    )
    const stored = this.storedEquipment.map(({ id }) => id)
    return [...equipped, ...stored, ...pending]
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
    const damage =
      hit.triggeringWeaponDamage *
      equipmentConfig.ring.additionalDamageMultiplier
    for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
      this.pendingRingStrikes.push({
        targetId: hit.targetId,
        hitEffectOrigin: { ...hit.hitEffectOrigin },
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

  public clear(): void {
    this.reservations.clear()
    this.storedEquipment.length = 0
    this.pendingRingStrikes.length = 0
    this.acceptedManualHitCount = 0
    this.ringTimeUntilNextStrikeMs = null
    this.nextReservationId = 1
    this.nextInstanceId = 1
    this.nextAcquiredSequence = 1
    for (let index = 0; index < this.slots.length; index += 1) {
      this.slots[index] = { status: 'empty' }
    }
  }

  private resetRingProgressAfterMove(ringCountBefore: number): void {
    if (ringCountBefore > 0 && this.getEquippedCount('ring') === 0) {
      this.acceptedManualHitCount = 0
    }
  }
}

function toEquipmentInstance(
  reservation: EquipmentReservation,
): EquipmentInstance {
  return {
    instanceId: reservation.instanceId,
    acquiredSequence: reservation.acquiredSequence,
    id: reservation.id,
    rarity: reservation.rarity,
  }
}
