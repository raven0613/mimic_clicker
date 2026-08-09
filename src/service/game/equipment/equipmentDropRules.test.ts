import { describe, expect, it } from 'vitest'

import { equipmentConfig } from '../../../configs/equipmentConfig'
import type { EquipmentCardAttachment } from '../attachedCards/attachedCardVisual'
import { selectVisibleEquipmentDrops } from './equipmentDropRules'

describe('equipment drop rules', () => {
  it('rolls every visible attachment independently and rejects the boundary', () => {
    const sword = { kind: 'equipment', id: 'sword', rarity: 'N' }
    const ring = { kind: 'equipment', id: 'ring', rarity: 'SR' }

    const result = selectVisibleEquipmentDrops(
      [sword, ring] as EquipmentCardAttachment[],
      sequenceRandom([
        equipmentConfig.visibleAttachmentDropChance / 2,
        equipmentConfig.visibleAttachmentDropChance,
      ]),
    )

    expect(result.successful).toEqual([sword])
    expect(result.failed).toEqual([ring])
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
