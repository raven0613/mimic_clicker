import { describe, expect, it } from 'vitest'

import { shouldCommitEquipmentDrop } from './equipmentPointerCompletion'

describe('equipment pointer completion', () => {
  it('commits a valid drop only after a normal pointer release', () => {
    expect(
      shouldCommitEquipmentDrop('released', true, {
        type: 'slot',
        slotIndex: 0,
      }),
    ).toBe(true)
  })

  it('never commits a drop when the pointer interaction is cancelled', () => {
    expect(
      shouldCommitEquipmentDrop('cancelled', true, {
        type: 'slot',
        slotIndex: 0,
      }),
    ).toBe(false)
  })

  it('does not commit a click or a release outside a destination', () => {
    expect(
      shouldCommitEquipmentDrop('released', false, {
        type: 'slot',
        slotIndex: 0,
      }),
    ).toBe(false)
    expect(shouldCommitEquipmentDrop('released', true, null)).toBe(false)
  })
})
