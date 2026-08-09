import { equipmentConfig } from '../../../configs/equipmentConfig'
export interface VisibleEquipmentDropResult<TEquipment> {
  successful: TEquipment[]
  failed: TEquipment[]
}

export function selectVisibleEquipmentDrops<TEquipment>(
  cards: readonly TEquipment[],
  random: () => number,
): VisibleEquipmentDropResult<TEquipment> {
  const successful: TEquipment[] = []
  const failed: TEquipment[] = []

  for (const card of cards) {
    const destination =
      random() < equipmentConfig.visibleAttachmentDropChance
        ? successful
        : failed
    destination.push(card)
  }

  return { successful, failed }
}
