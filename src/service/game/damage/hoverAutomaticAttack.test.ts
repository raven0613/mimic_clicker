import { describe, expect, it } from 'vitest'

import { advanceHoverAutomaticAttack } from './hoverAutomaticAttack'

describe('hover automatic attack timer', () => {
  it('waits until the configured interval boundary', () => {
    const waiting = advanceHoverAutomaticAttack(600, 599, 600)
    const ready = advanceHoverAutomaticAttack(waiting.remainingMs, 1, 600)

    expect(waiting).toEqual({ shouldAttack: false, remainingMs: 1 })
    expect(ready).toEqual({ shouldAttack: true, remainingMs: 600 })
  })

  it('does not bank multiple attacks after a delayed frame', () => {
    expect(advanceHoverAutomaticAttack(10, 2_000, 600)).toEqual({
      shouldAttack: true,
      remainingMs: 600,
    })
  })

  it('can exclude an exact round-end boundary', () => {
    expect(advanceHoverAutomaticAttack(50, 50, 600, false)).toEqual({
      shouldAttack: false,
      remainingMs: 0,
    })
  })

  it('rejects invalid intervals', () => {
    expect(() => advanceHoverAutomaticAttack(1, 1, 0)).toThrow(/interval/i)
  })
})
