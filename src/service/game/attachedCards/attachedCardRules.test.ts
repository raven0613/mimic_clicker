import { describe, expect, it, vi } from 'vitest'

import { attachedCardConfig } from '../../../configs/attachedCardConfig'
import { effectCardConfig } from '../../../configs/effectCardConfig'
import { equipmentConfig } from '../../../configs/equipmentConfig'
import {
  selectAttachedCardAssignments,
  selectHiddenEquipmentId,
  selectJackpotAttachedCardAssignments,
} from './attachedCardRules'

describe('attached card rules', () => {
  it('does not roll attached or hidden content for decorative Mimics', () => {
    const random = vi.fn(() => 0)

    expect(
      selectAttachedCardAssignments({
        decorative: true,
        maximumCount: attachedCardConfig.capacity.jackpot.maximum,
        random,
      }),
    ).toEqual([])
    expect(selectHiddenEquipmentId(true, [], random)).toBeNull()
    expect(random).not.toHaveBeenCalled()
  })

  it('fairly clips effect and equipment candidates through one capacity', () => {
    const candidateRolls = [
      effectCardConfig.thunder.carrierSpawnChance / 2,
      1,
      1,
      equipmentConfig.sword.carrierSpawnChance / 2,
      1,
    ]

    expect(
      selectAttachedCardAssignments({
        decorative: false,
        maximumCount: attachedCardConfig.capacity.byMimic.normal,
        random: sequenceRandom([...candidateRolls, 0]),
      }),
    ).toEqual([
      { kind: 'effect', id: 'thunder', frameId: 'normal', rarity: 'N' },
    ])
    expect(
      selectAttachedCardAssignments({
        decorative: false,
        maximumCount: attachedCardConfig.capacity.byMimic.normal,
        random: sequenceRandom([...candidateRolls, 0.999]),
      }),
    ).toEqual([
      { kind: 'equipment', id: 'sword', rarity: 'N' },
    ])
  })

  it('selects Jackpot cards from the shared unique content pool', () => {
    const assignments = selectJackpotAttachedCardAssignments(() => 0)

    expect(assignments).toHaveLength(
      attachedCardConfig.capacity.jackpot.minimum,
    )
    expect(
      new Set(assignments.map(({ kind, id }) => `${kind}:${id}`)).size,
    ).toBe(assignments.length)
    expect(
      assignments.filter(({ kind }) => kind === 'effect'),
    ).toHaveLength(attachedCardConfig.capacity.jackpot.minimum)
  })

  it('selects at most one hidden item and excludes visible equipment ids', () => {
    const hiddenRarity = equipmentConfig.hiddenDropRarityChances
    const nRoll = hiddenRarity.none + hiddenRarity.N / 2
    const srRoll =
      hiddenRarity.none +
      hiddenRarity.N +
      hiddenRarity.R +
      hiddenRarity.SR / 2

    expect(
      selectHiddenEquipmentId(
        false,
        [],
        sequenceRandom([nRoll, 0]),
      ),
    ).toBe('sword')
    expect(
      selectHiddenEquipmentId(
        false,
        ['sword'],
        sequenceRandom([nRoll]),
      ),
    ).toBeNull()
    expect(
      selectHiddenEquipmentId(
        false,
        [],
        sequenceRandom([srRoll, 0]),
      ),
    ).toBe('ring')
  })

  it('keeps the configured none interval free of hidden equipment', () => {
    expect(
      selectHiddenEquipmentId(
        false,
        [],
        () => equipmentConfig.hiddenDropRarityChances.none / 2,
      ),
    ).toBeNull()
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
