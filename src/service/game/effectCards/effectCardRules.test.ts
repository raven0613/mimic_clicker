import { describe, expect, it, vi } from 'vitest'

import { attachedCardConfig } from '../../../configs/attachedCardConfig'
import { combatConfig } from '../../../configs/combatConfig'
import { effectCardConfig } from '../../../configs/effectCardConfig'
import {
  advanceEffectCardWindup,
  calculateInitialMeteoriteDamage,
  calculateInitialThunderDamage,
  selectEffectCardAssignments,
  selectJackpotEffectCardAssignments,
  selectJackpotTargetCardCount,
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

  it('rolls thunder and meteorite independently and rejects each boundary', () => {
    const thunderChance = effectCardConfig.thunder.carrierSpawnChance
    const meteoriteChance = effectCardConfig.meteorite.carrierSpawnChance

    expect(
      selectEffectCardAssignments(false, 2, sequenceRandom([
        thunderChance / 2,
        meteoriteChance,
      ])),
    ).toEqual([
      { id: 'thunder', frameId: 'normal', rarity: 'normal' },
    ])
    expect(
      selectEffectCardAssignments(false, 2, sequenceRandom([
        thunderChance,
        meteoriteChance / 2,
      ])),
    ).toEqual([
      { id: 'meteorite', frameId: 'normal', rarity: 'ssr' },
    ])
  })

  it('keeps both unique cards when capacity can hold both', () => {
    const assignments = selectEffectCardAssignments(
      false,
      attachedCardConfig.capacity.byMimic.rare2,
      () => 0,
    )

    expect(assignments).toHaveLength(new Set(assignments.map(({ id }) => id)).size)
    expect(assignments).toEqual([
      { id: 'thunder', frameId: 'normal', rarity: 'normal' },
      { id: 'meteorite', frameId: 'normal', rarity: 'ssr' },
    ])
  })

  it('fairly selects either candidate when both exceed capacity', () => {
    const candidateRolls = [0, 0]

    expect(
      selectEffectCardAssignments(
        false,
        attachedCardConfig.capacity.byMimic.normal,
        sequenceRandom([...candidateRolls, 0]),
      ),
    ).toEqual([
      { id: 'thunder', frameId: 'normal', rarity: 'normal' },
    ])
    expect(
      selectEffectCardAssignments(
        false,
        attachedCardConfig.capacity.byMimic.normal,
        sequenceRandom([...candidateRolls, 0.999]),
      ),
    ).toEqual([
      { id: 'meteorite', frameId: 'normal', rarity: 'ssr' },
    ])
  })

  it('selects the Jackpot minimum or maximum target from config chances', () => {
    const jackpot = attachedCardConfig.capacity.jackpot

    expect(
      selectJackpotTargetCardCount(
        () => jackpot.countSelectionChances.minimum / 2,
      ),
    ).toBe(jackpot.minimum)
    expect(
      selectJackpotTargetCardCount(
        () => jackpot.countSelectionChances.minimum,
      ),
    ).toBe(jackpot.maximum)
  })

  it('guarantees every available unique effect card for the current Jackpot', () => {
    const random = vi.fn(() => 1)
    const assignments = selectJackpotEffectCardAssignments(random)

    expect(assignments).toEqual([
      { id: 'thunder', frameId: 'normal', rarity: 'normal' },
      { id: 'meteorite', frameId: 'normal', rarity: 'ssr' },
    ])
    expect(assignments).toHaveLength(
      new Set(assignments.map(({ id }) => id)).size,
    )
    expect(random).toHaveBeenCalledTimes(1)
  })

  it('derives thunder damage from the initial weapon damage', () => {
    expect(calculateInitialThunderDamage()).toBe(
      combatConfig.initialWeaponDamage *
        effectCardConfig.thunder.initialWeaponDamageMultiplier,
    )
  })

  it('derives meteorite damage from the initial weapon damage', () => {
    expect(calculateInitialMeteoriteDamage()).toBe(
      combatConfig.initialWeaponDamage *
        effectCardConfig.meteorite.initialWeaponDamageMultiplier,
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

function sequenceRandom(values: number[]): () => number {
  let index = 0
  return () => {
    const value = values[index]
    index += 1
    if (value === undefined) throw new Error('Random sequence exhausted')
    return value
  }
}
