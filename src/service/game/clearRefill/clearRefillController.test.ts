import { describe, expect, it } from 'vitest'

import { clearRefillConfig } from '../../../configs/clearRefillConfig'
import { ClearRefillController } from './clearRefillController'

const activeEmptyField = {
  hasActiveEffectChain: true,
  effectiveTargetCount: 0,
  isJackpotChaseActive: false,
  isRoundActive: true,
  remainingRoundMs: clearRefillConfig.minimumRemainingRoundMs + 1,
}

describe('ClearRefillController', () => {
  it('confirms an empty field only after a defeated target and the configured delay', () => {
    const controller = new ClearRefillController()

    controller.notifyTargetRemoved({
      cause: 'defeat',
      ...activeEmptyField,
    })

    expect(
      controller.update({
        ...activeEmptyField,
        deltaMs: clearRefillConfig.confirmationDelayMs - 1,
      }),
    ).toBeNull()
    expect(
      controller.update({
        ...activeEmptyField,
        deltaMs: 1,
      }),
    ).toEqual({ effectiveTargetCount: 0, isFullClear: true })
  })

  it('does not start confirmation after natural flow exit', () => {
    const controller = new ClearRefillController()

    controller.notifyTargetRemoved({
      cause: 'flowExit',
      ...activeEmptyField,
    })

    expect(
      controller.update({
        ...activeEmptyField,
        deltaMs: clearRefillConfig.confirmationDelayMs,
      }),
    ).toBeNull()
  })

  it('does not start confirmation above the low-density threshold', () => {
    const controller = new ClearRefillController()
    const populatedField = {
      ...activeEmptyField,
      effectiveTargetCount:
        clearRefillConfig.triggerMaximumEffectiveTargetCount + 1,
    }

    controller.notifyTargetRemoved({ cause: 'defeat', ...populatedField })

    expect(
      controller.update({
        ...activeEmptyField,
        deltaMs: clearRefillConfig.confirmationDelayMs,
      }),
    ).toBeNull()
  })

  it('cancels confirmation when the effective target count rises above the threshold', () => {
    const controller = new ClearRefillController()
    controller.notifyTargetRemoved({
      cause: 'defeat',
      ...activeEmptyField,
    })

    expect(
      controller.update({
        ...activeEmptyField,
        effectiveTargetCount:
          clearRefillConfig.triggerMaximumEffectiveTargetCount + 1,
        deltaMs: clearRefillConfig.confirmationDelayMs,
      }),
    ).toBeNull()
    expect(
      controller.update({
        ...activeEmptyField,
        deltaMs: clearRefillConfig.confirmationDelayMs,
      }),
    ).toBeNull()
  })

  it('rejects confirmation below the configured remaining round time', () => {
    const controller = new ClearRefillController()
    controller.notifyTargetRemoved({
      cause: 'defeat',
      ...activeEmptyField,
      remainingRoundMs: clearRefillConfig.minimumRemainingRoundMs - 1,
    })

    expect(
      controller.update({
        ...activeEmptyField,
        remainingRoundMs: clearRefillConfig.minimumRemainingRoundMs - 1,
        deltaMs: clearRefillConfig.confirmationDelayMs,
      }),
    ).toBeNull()
  })

  it('allows at most one refill while the automatic effect chain remains active', () => {
    const controller = new ClearRefillController()
    controller.notifyTargetRemoved({ cause: 'defeat', ...activeEmptyField })
    expect(
      controller.update({
        ...activeEmptyField,
        deltaMs: clearRefillConfig.confirmationDelayMs,
      }),
    ).toEqual({ effectiveTargetCount: 0, isFullClear: true })

    controller.notifyTargetRemoved({ cause: 'defeat', ...activeEmptyField })
    expect(
      controller.update({
        ...activeEmptyField,
        deltaMs: clearRefillConfig.confirmationDelayMs,
      }),
    ).toBeNull()
  })

  it('re-enables a future clear after valid manual weapon damage', () => {
    const controller = createLockedController()

    controller.notifyValidManualWeaponDamage()
    controller.notifyTargetRemoved({ cause: 'defeat', ...activeEmptyField })

    expect(
      controller.update({
        ...activeEmptyField,
        deltaMs: clearRefillConfig.confirmationDelayMs,
      }),
    ).toEqual({ effectiveTargetCount: 0, isFullClear: true })
  })

  it('unlocks when the effect chain ends without refilling an earlier empty field retroactively', () => {
    const controller = createLockedController()
    controller.notifyTargetRemoved({ cause: 'defeat', ...activeEmptyField })

    expect(
      controller.update({
        ...activeEmptyField,
        hasActiveEffectChain: false,
        deltaMs: clearRefillConfig.confirmationDelayMs,
      }),
    ).toBeNull()

    controller.notifyTargetRemoved({
      cause: 'defeat',
      ...activeEmptyField,
      hasActiveEffectChain: false,
    })
    expect(
      controller.update({
        ...activeEmptyField,
        hasActiveEffectChain: false,
        deltaMs: clearRefillConfig.confirmationDelayMs,
      }),
    ).toEqual({ effectiveTargetCount: 0, isFullClear: true })
  })

  it('confirms a low-density refill without reporting a full clear', () => {
    const controller = new ClearRefillController()
    const lowDensityField = {
      ...activeEmptyField,
      effectiveTargetCount:
        clearRefillConfig.triggerMaximumEffectiveTargetCount,
    }

    controller.notifyTargetRemoved({ cause: 'defeat', ...lowDensityField })

    expect(
      controller.update({
        ...lowDensityField,
        deltaMs: clearRefillConfig.confirmationDelayMs,
      }),
    ).toEqual({
      effectiveTargetCount:
        clearRefillConfig.triggerMaximumEffectiveTargetCount,
      isFullClear: false,
    })
  })

  it('cancels a pending refill when the Jackpot chase begins', () => {
    const controller = new ClearRefillController()
    controller.notifyTargetRemoved({ cause: 'defeat', ...activeEmptyField })

    expect(
      controller.update({
        ...activeEmptyField,
        isJackpotChaseActive: true,
        deltaMs: clearRefillConfig.confirmationDelayMs,
      }),
    ).toBeNull()
  })

  it('clears pending and locked state when reset for round cleanup', () => {
    const controller = createLockedController()
    controller.reset()
    controller.notifyTargetRemoved({ cause: 'defeat', ...activeEmptyField })

    expect(
      controller.update({
        ...activeEmptyField,
        deltaMs: clearRefillConfig.confirmationDelayMs,
      }),
    ).toEqual({ effectiveTargetCount: 0, isFullClear: true })
  })
})

function createLockedController(): ClearRefillController {
  const controller = new ClearRefillController()
  controller.notifyTargetRemoved({ cause: 'defeat', ...activeEmptyField })
  controller.update({
    ...activeEmptyField,
    deltaMs: clearRefillConfig.confirmationDelayMs,
  })
  return controller
}
