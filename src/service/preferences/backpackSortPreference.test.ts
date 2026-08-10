import { describe, expect, it, vi } from 'vitest'

import {
  loadBackpackSortMode,
  saveBackpackSortMode,
  type PreferenceStorage,
} from './backpackSortPreference'

describe('backpack sort preference', () => {
  it('persists and restores a supported sort mode', () => {
    const values = new Map<string, string>()
    const storage: PreferenceStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    }

    saveBackpackSortMode('rarityHighest', storage)

    expect(loadBackpackSortMode(storage)).toBe('rarityHighest')
  })

  it('falls back to newest acquisition when storage is invalid or unavailable', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const invalidStorage: PreferenceStorage = {
      getItem: () => 'unsupported',
      setItem: () => undefined,
    }
    const unavailableStorage: PreferenceStorage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }

    expect(loadBackpackSortMode(invalidStorage)).toBe('acquiredNewest')
    expect(loadBackpackSortMode(unavailableStorage)).toBe('acquiredNewest')
    expect(() =>
      saveBackpackSortMode('rarityHighest', unavailableStorage),
    ).not.toThrow()
    expect(warning).toHaveBeenCalled()
    warning.mockRestore()
  })
})
