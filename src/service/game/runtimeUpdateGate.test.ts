import { describe, expect, it } from 'vitest'

import { shouldAdvanceRuntime } from './runtimeUpdateGate'

describe('runtime update gate', () => {
  it('freezes the active game while the backpack pause is enabled', () => {
    expect(shouldAdvanceRuntime('active', true)).toBe(false)
    expect(shouldAdvanceRuntime('active', false)).toBe(true)
  })

  it('does not make the backpack pause affect decorative rendering', () => {
    expect(shouldAdvanceRuntime('decorative', true)).toBe(true)
    expect(shouldAdvanceRuntime('idle', false)).toBe(false)
  })
})
