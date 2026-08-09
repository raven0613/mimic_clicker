import { describe, expect, it } from 'vitest'

import { combatConfig } from '../../configs/combatConfig'
import { permanentUpgradeConfig } from '../../configs/permanentUpgradeConfig'
import {
  createWeaponAttackSchedule,
  simulateRequiredWeaponHits,
} from './weaponAttackSimulation'

describe('weapon attack simulation', () => {
  const intervalMs = combatConfig.minimumWeaponDamageIntervalPerTargetMs

  it('counts rejected rapid attempts before the required hits complete', () => {
    const result = simulateRequiredWeaponHits(2, 0, intervalMs / 2, 0)

    expect(result.attemptCount).toBe(3)
    expect(result.completedAtMs).toBe(intervalMs * 1.5)
    expect(result.nextAllowedAtMs).toBe(intervalMs * 2.5)
  })

  it('accepts periodic attempts at the exact interval boundary', () => {
    const result = simulateRequiredWeaponHits(2, 0, intervalMs, 0)

    expect(result.attemptCount).toBe(2)
    expect(result.completedAtMs).toBe(intervalMs * 2)
  })

  it('carries an existing target interval into the next attack sequence', () => {
    const result = simulateRequiredWeaponHits(
      1,
      0,
      intervalMs / 2,
      intervalMs * 2,
    )

    expect(result.attemptCount).toBe(4)
    expect(result.completedAtMs).toBe(intervalMs * 2)
  })

  it('orders manual attempts before automatic attempts at a shared boundary', () => {
    const intervalMs =
      permanentUpgradeConfig.hoverAutoAttack.intervalMsByLevel[0]
    const attempts = createWeaponAttackSchedule(intervalMs, intervalMs)

    expect(attempts.slice(0, 2).map(({ source }) => source)).toEqual([
      'manualWeapon',
      'automaticWeapon',
    ])
  })

  it('rejects an invalid automatic attack interval', () => {
    expect(() => createWeaponAttackSchedule(intervalMs, 0)).toThrow(/interval/i)
  })
})
