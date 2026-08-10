import type { EquipmentDestination } from '../../service/game/equipment/equipmentState'

export type EquipmentPointerEndReason = 'released' | 'cancelled'

export function shouldCommitEquipmentDrop(
  endReason: EquipmentPointerEndReason,
  isDragging: boolean,
  destination: EquipmentDestination | null,
): destination is EquipmentDestination {
  return endReason === 'released' && isDragging && destination !== null
}
