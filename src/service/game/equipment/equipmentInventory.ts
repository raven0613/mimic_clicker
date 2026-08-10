import type { AttachedCardRarity } from '../../../configs/attachedCardConfig'
import type { EquipmentInstance } from './equipmentState'

export type EquipmentSortMode = 'acquiredNewest' | 'rarityHighest'

const rarityPriority: Record<AttachedCardRarity, number> = {
  N: 0,
  R: 1,
  SR: 2,
  SSR: 3,
  UR: 4,
}

export function sortEquipmentInstances(
  instances: readonly EquipmentInstance[],
  mode: EquipmentSortMode,
): EquipmentInstance[] {
  return [...instances].sort((first, second) => {
    if (mode === 'rarityHighest') {
      const rarityDifference =
        rarityPriority[second.rarity] - rarityPriority[first.rarity]
      if (rarityDifference !== 0) return rarityDifference
    }
    return second.acquiredSequence - first.acquiredSequence
  })
}
