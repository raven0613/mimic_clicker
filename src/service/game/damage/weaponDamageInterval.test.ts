import { describe, expect, it } from 'vitest'

import { combatConfig } from '../../../configs/combatConfig'
import { evaluateWeaponDamageInterval } from './weaponDamageInterval'

describe('weapon damage interval', () => {
  const intervalMs = combatConfig.minimumWeaponDamageIntervalPerTargetMs

  it('allows the first hit immediately', () => {
    expect(evaluateWeaponDamageInterval(0, 0)).toEqual({
      isAllowed: true,
      nextAllowedAtMs: intervalMs,
    })
  })

  it('rejects a hit before the target interval expires', () => {
    expect(evaluateWeaponDamageInterval(intervalMs, intervalMs - 1)).toEqual({
      isAllowed: false,
      nextAllowedAtMs: intervalMs,
    })
  })

  it('allows a hit exactly at the interval boundary', () => {
    expect(evaluateWeaponDamageInterval(intervalMs, intervalMs)).toEqual({
      isAllowed: true,
      nextAllowedAtMs: intervalMs * 2,
    })
  })

  it('tracks targets independently', () => {
    const firstTarget = evaluateWeaponDamageInterval(0, 0)
    const secondTarget = evaluateWeaponDamageInterval(0, 0)

    expect(firstTarget.isAllowed).toBe(true)
    expect(secondTarget.isAllowed).toBe(true)
  })
})
