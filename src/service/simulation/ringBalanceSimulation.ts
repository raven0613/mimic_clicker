import { equipmentConfig } from '../../configs/equipmentConfig'
import type {
  PendingEffectEvent,
  SimulatedCombatMimic,
  SimulatedRingStrike,
} from './effectCardBalanceTypes'

interface RingBalanceTrackerInput {
  damageTarget: (
    target: SimulatedCombatMimic,
    damage: number,
    atMs: number,
  ) => void
  enqueueEvent: (event: PendingEffectEvent) => void
  getTarget: (targetId: number, atMs: number) => SimulatedCombatMimic | null
  ringCount: number
}

export class RingBalanceTracker {
  private readonly input: RingBalanceTrackerInput
  private acceptedManualHitCount = 0
  private queueTailAtMs = 0

  public constructor(input: RingBalanceTrackerInput) {
    this.input = input
  }

  public recordAcceptedManualHit(
    atMs: number,
    targetId: number,
    weaponDamage: number,
  ): void {
    if (this.input.ringCount === 0) return
    this.acceptedManualHitCount += 1
    if (
      this.acceptedManualHitCount <
      equipmentConfig.ring.acceptedManualHitsPerTrigger
    ) {
      return
    }

    this.acceptedManualHitCount = 0
    this.queueTailAtMs = Math.max(atMs, this.queueTailAtMs)
    for (let index = 0; index < this.input.ringCount; index += 1) {
      this.queueTailAtMs += equipmentConfig.ring.additionalHitIntervalMs
      this.input.enqueueEvent({
        kind: 'ringStrike',
        strikeAtMs: this.queueTailAtMs,
        targetId,
        damage:
          weaponDamage * equipmentConfig.ring.additionalDamageMultiplier,
        chainId: null,
      })
    }
  }

  public processStrike(event: SimulatedRingStrike): void {
    const target = this.input.getTarget(event.targetId, event.strikeAtMs)
    if (target) this.input.damageTarget(target, event.damage, event.strikeAtMs)
  }
}
