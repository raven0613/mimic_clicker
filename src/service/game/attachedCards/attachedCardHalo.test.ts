import { describe, expect, it } from 'vitest'

import {
  attachedCardConfig,
  glowingAttachedCardRarities,
} from '../../../configs/attachedCardConfig'
import { getAttachedCardHaloConfig } from './attachedCardHalo'

describe('attached card halo rarity resolution', () => {
  it('does not provide halo resources for N cards', () => {
    expect(getAttachedCardHaloConfig('N')).toBeNull()
  })

  it('resolves every glowing rarity directly from the shared config', () => {
    expect(Object.keys(attachedCardConfig.haloByRarity)).toEqual(
      glowingAttachedCardRarities,
    )
    for (const rarity of glowingAttachedCardRarities) {
      expect(getAttachedCardHaloConfig(rarity)).toBe(
        attachedCardConfig.haloByRarity[rarity],
      )
    }
  })

  it('keeps UR as a fixed diagonal linear gradient configured in data', () => {
    const urHalo = getAttachedCardHaloConfig('UR')

    expect(urHalo).not.toBeNull()
    expect(urHalo?.color.kind).toBe('linearGradient')
    if (urHalo?.color.kind !== 'linearGradient') return
    expect(urHalo.color.start).toBe(attachedCardConfig.haloByRarity.UR.color.start)
    expect(urHalo.color.end).toBe(attachedCardConfig.haloByRarity.UR.color.end)
    expect(urHalo.color.colorStops).toBe(
      attachedCardConfig.haloByRarity.UR.color.colorStops,
    )
  })
})
