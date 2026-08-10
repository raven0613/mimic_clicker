import {
  equipmentConfig,
  equipmentDefinitions,
  type EquipmentId,
} from '../../../configs/equipmentConfig'

export interface EquipmentPresentation {
  displayName: string
  effectText: string
}

const displayNameById = new Map(
  equipmentDefinitions.map(({ id, displayName }) => [id, displayName]),
)

export function getEquipmentPresentation(
  id: EquipmentId,
): EquipmentPresentation {
  const displayName = displayNameById.get(id)
  if (!displayName) {
    throw new Error(`Missing equipment presentation for ${id}`)
  }
  if (id === 'sword') {
    return {
      displayName,
      effectText: `攻擊力 + ${equipmentConfig.sword.weaponDamageBonus}。`,
    }
  }
  return {
    displayName,
    effectText: `每累積 ${equipmentConfig.ring.acceptedManualHitsPerTrigger} 次手動命中，觸發一次 ${Math.round(equipmentConfig.ring.additionalDamageMultiplier * 100)}% 傷害的追加攻擊。`,
  }
}
