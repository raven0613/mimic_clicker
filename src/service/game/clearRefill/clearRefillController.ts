import { clearRefillConfig } from '../../../configs/clearRefillConfig'

type TargetRemovalCause = 'defeat' | 'flowExit'

interface ClearRefillFieldState {
  hasActiveEffectChain: boolean
  hasEffectiveTarget: boolean
  isRoundActive: boolean
  remainingRoundMs: number
}

interface NotifyTargetRemovedInput extends ClearRefillFieldState {
  cause: TargetRemovalCause
}

interface UpdateClearRefillInput extends ClearRefillFieldState {
  deltaMs: number
}

export class ClearRefillController {
  private confirmationRemainingMs: number | null = null
  private refillLocked = false

  public notifyTargetRemoved(input: NotifyTargetRemovedInput): void {
    if (
      input.cause !== 'defeat' ||
      !input.isRoundActive ||
      input.hasEffectiveTarget ||
      input.remainingRoundMs < clearRefillConfig.minimumRemainingRoundMs ||
      this.refillLocked ||
      this.confirmationRemainingMs !== null
    ) {
      return
    }

    this.confirmationRemainingMs = clearRefillConfig.confirmationDelayMs
  }

  public notifyValidManualWeaponDamage(): void {
    this.refillLocked = false
  }

  public update(input: UpdateClearRefillInput): boolean {
    if (!input.isRoundActive) {
      this.reset()
      return false
    }

    if (this.refillLocked && !input.hasActiveEffectChain) {
      this.refillLocked = false
    }
    if (this.confirmationRemainingMs === null) return false
    if (
      input.hasEffectiveTarget ||
      input.remainingRoundMs < clearRefillConfig.minimumRemainingRoundMs
    ) {
      this.confirmationRemainingMs = null
      return false
    }

    this.confirmationRemainingMs -= Math.max(0, input.deltaMs)
    if (this.confirmationRemainingMs > 0) return false

    this.confirmationRemainingMs = null
    this.refillLocked = true
    return true
  }

  public reset(): void {
    this.confirmationRemainingMs = null
    this.refillLocked = false
  }
}
