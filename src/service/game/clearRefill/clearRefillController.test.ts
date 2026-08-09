import { describe, expect, it } from 'vitest'

import { clearRefillConfig } from '../../../configs/clearRefillConfig'
import { ClearRefillController } from './clearRefillController'

const activeEmptyField = {
  hasActiveEffectChain: true,
  hasEffectiveTarget: false,
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
    ).toBe(false)
    expect(
      controller.update({
        ...activeEmptyField,
        deltaMs: 1,
      }),
    ).toBe(true)
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
    ).toBe(false)
  })

  it('cancels confirmation when a target becomes effective', () => {
    const controller = new ClearRefillController()
    controller.notifyTargetRemoved({
      cause: 'defeat',
      ...activeEmptyField,
    })

    expect(
      controller.update({
        ...activeEmptyField,
        hasEffectiveTarget: true,
        deltaMs: clearRefillConfig.confirmationDelayMs,
      }),
    ).toBe(false)
    expect(
      controller.update({
        ...activeEmptyField,
        deltaMs: clearRefillConfig.confirmationDelayMs,
      }),
    ).toBe(false)
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
    ).toBe(false)
  })

  it('allows at most one refill while the automatic effect chain remains active', () => {
    const controller = new ClearRefillController()
    controller.notifyTargetRemoved({ cause: 'defeat', ...activeEmptyField })
    expect(
      controller.update({
        ...activeEmptyField,
        deltaMs: clearRefillConfig.confirmationDelayMs,
      }),
    ).toBe(true)

    controller.notifyTargetRemoved({ cause: 'defeat', ...activeEmptyField })
    expect(
      controller.update({
        ...activeEmptyField,
        deltaMs: clearRefillConfig.confirmationDelayMs,
      }),
    ).toBe(false)
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
    ).toBe(true)
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
    ).toBe(false)

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
    ).toBe(true)
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
    ).toBe(true)
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
