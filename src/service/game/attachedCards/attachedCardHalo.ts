import {
  attachedCardConfig,
  type AttachedCardHaloConfig,
  type AttachedCardRarity,
} from '../../../configs/attachedCardConfig'

export function getAttachedCardHaloConfig(
  rarity: AttachedCardRarity,
): AttachedCardHaloConfig | null {
  if (rarity === 'N') return null
  return attachedCardConfig.haloByRarity[rarity]
}
