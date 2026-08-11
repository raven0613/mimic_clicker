import { clearRefillConfig } from '../../../configs/clearRefillConfig'

type TargetRemovalCause = 'defeat' | 'flowExit'

interface ClearRefillFieldState {
  hasActiveEffectChain: boolean
  effectiveTargetCount: number
  isJackpotChaseActive: boolean
  isRoundActive: boolean
  remainingRoundMs: number
}

interface NotifyTargetRemovedInput extends ClearRefillFieldState {
  cause: TargetRemovalCause
}

interface UpdateClearRefillInput extends ClearRefillFieldState {
  deltaMs: number
}

export interface ClearRefillDecision {
  effectiveTargetCount: number
  isFullClear: boolean
}

export class ClearRefillController {
  private confirmationRemainingMs: number | null = null
  private refillLocked = false

  public notifyTargetRemoved(input: NotifyTargetRemovedInput): void {
    if (
      input.cause !== 'defeat' ||
      !input.isRoundActive ||
      input.isJackpotChaseActive ||
      input.effectiveTargetCount >
        clearRefillConfig.triggerMaximumEffectiveTargetCount ||
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

  public update(input: UpdateClearRefillInput): ClearRefillDecision | null {
    if (!input.isRoundActive) {
      this.reset()
      return null
    }

    if (this.refillLocked && !input.hasActiveEffectChain) {
      this.refillLocked = false
    }
    if (this.confirmationRemainingMs === null) return null
    if (
      input.isJackpotChaseActive ||
      input.effectiveTargetCount >
        clearRefillConfig.triggerMaximumEffectiveTargetCount ||
      input.remainingRoundMs < clearRefillConfig.minimumRemainingRoundMs
    ) {
      this.confirmationRemainingMs = null
      return null
    }

    this.confirmationRemainingMs -= Math.max(0, input.deltaMs)
    if (this.confirmationRemainingMs > 0) return null

    this.confirmationRemainingMs = null
    this.refillLocked = true
    return {
      effectiveTargetCount: input.effectiveTargetCount,
      isFullClear: input.effectiveTargetCount === 0,
    }
  }

  public reset(): void {
    this.confirmationRemainingMs = null
    this.refillLocked = false
  }
}
