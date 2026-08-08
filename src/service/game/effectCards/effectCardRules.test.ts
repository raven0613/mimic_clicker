import { describe, expect, it, vi } from 'vitest'

import { attachedCardConfig } from '../../../configs/attachedCardConfig'
import { combatConfig } from '../../../configs/combatConfig'
import { effectCardConfig } from '../../../configs/effectCardConfig'
import {
  advanceEffectCardWindup,
  calculateInitialThunderDamage,
  selectEffectCardAssignments,
} from './effectCardRules'

describe('effect card rules', () => {
  it('does not roll an effect card for decorative mimics', () => {
    const random = vi.fn(() => 0)

    expect(
      selectEffectCardAssignments(
        true,
        attachedCardConfig.capacity.jackpot.maximum,
        random,
      ),
    ).toEqual([])
    expect(random).not.toHaveBeenCalled()
  })

  it('attaches thunder below the configured chance and rejects the boundary', () => {
    const chance = effectCardConfig.thunder.carrierSpawnChance

    expect(selectEffectCardAssignments(false, 1, () => chance / 2)).toEqual([
      { id: 'thunder', rarity: 'normal' },
    ])
    expect(selectEffectCardAssignments(false, 1, () => chance)).toEqual([])
  })

  it('does not duplicate the only available effect card to fill capacity', () => {
    const assignments = selectEffectCardAssignments(
      false,
      attachedCardConfig.capacity.jackpot.maximum,
      () => 0,
    )

    expect(assignments).toHaveLength(new Set(assignments.map(({ id }) => id)).size)
    expect(assignments).toEqual([{ id: 'thunder', rarity: 'normal' }])
  })

  it('derives thunder damage from the initial weapon damage', () => {
    expect(calculateInitialThunderDamage()).toBe(
      combatConfig.initialWeaponDamage *
        effectCardConfig.thunder.initialWeaponDamageMultiplier,
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
