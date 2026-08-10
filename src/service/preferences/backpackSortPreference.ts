import type { EquipmentSortMode } from '../game/equipment/equipmentInventory'

export interface PreferenceStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

const storageKey = 'mimic-clicker:backpack-sort-mode'
const defaultSortMode: EquipmentSortMode = 'acquiredNewest'

export function loadBackpackSortMode(
  storage: PreferenceStorage = window.localStorage,
): EquipmentSortMode {
  try {
    const stored = storage.getItem(storageKey)
    return stored === 'rarityHighest' || stored === 'acquiredNewest'
      ? stored
      : defaultSortMode
  } catch (error) {
    console.warn('Unable to load the backpack sort preference.', error)
    return defaultSortMode
  }
}

export function saveBackpackSortMode(
  mode: EquipmentSortMode,
  storage: PreferenceStorage = window.localStorage,
): void {
  try {
    storage.setItem(storageKey, mode)
  } catch (error) {
    console.warn('Unable to save the backpack sort preference.', error)
  }
}
