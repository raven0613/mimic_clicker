import { describe, expect, it } from 'vitest'

import { effectCardConfig } from '../../../configs/effectCardConfig'
import { getInitialWeaponDefinition } from '../../progression/weaponProgression'
import {
  advanceEffectCardWindup,
  calculateInitialMeteoriteDamage,
  calculateInitialThunderDamage,
  calculateInitialTornadoDamage,
} from './effectCardRules'

describe('effect card rules', () => {
  it('derives thunder damage from the initial weapon damage', () => {
    expect(calculateInitialThunderDamage()).toBe(
      getInitialWeaponDefinition().baseDamage *
        effectCardConfig.thunder.initialWeaponDamageMultiplier,
    )
  })

  it('derives meteorite damage from the initial weapon damage', () => {
    expect(calculateInitialMeteoriteDamage()).toBe(
      getInitialWeaponDefinition().baseDamage *
        effectCardConfig.meteorite.initialWeaponDamageMultiplier,
    )
  })

  it('derives tornado damage from the initial weapon damage', () => {
    expect(calculateInitialTornadoDamage()).toBe(
      getInitialWeaponDefinition().baseDamage *
        effectCardConfig.tornado.initialWeaponDamageMultiplier,
    )
  })

  it('becomes ready exactly at the configured windup duration', () => {
    const durationMs = effectCardConfig.ejection.durationMs

    expect(advanceEffectCardWindup(0, durationMs - 1)).toEqual({
      elapsedMs: durationMs - 1,
      isReady: false,
    })
    expect(advanceEffectCardWindup(durationMs - 1, 1)).toEqual({
      elapsedMs: durationMs,
      isReady: true,
    })
  })
})
