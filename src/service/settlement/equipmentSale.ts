import { settlementConfig } from '../../configs/settlementConfig'
import {
  equipmentDefinitions,
  type EquipmentId,
} from '../../configs/equipmentConfig'
import type { EquipmentSaleGroup } from '../../types/game'

export interface EquipmentSaleSummary {
  groups: EquipmentSaleGroup[]
  totalGold: number
}

export function calculateEquipmentSale(
  equipmentIds: readonly EquipmentId[],
): EquipmentSaleSummary {
  const quantities = new Map<EquipmentId, number>()
  for (const equipmentId of equipmentIds) {
    quantities.set(equipmentId, (quantities.get(equipmentId) ?? 0) + 1)
  }

  const groups = equipmentDefinitions.flatMap((definition) => {
    const quantity = quantities.get(definition.id) ?? 0
    if (quantity === 0) return []
    const unitPriceGold = Math.round(
      settlementConfig.equipmentSale.basePriceGold *
        settlementConfig.equipmentSale.rarityPriceMultipliers[
          definition.rarity
        ],
    )
    return [{
      equipmentId: definition.id,
      quantity,
      unitPriceGold,
      subtotalGold: unitPriceGold * quantity,
    }]
  })

  return {
    groups,
    totalGold: groups.reduce(
      (total, group) => total + group.subtotalGold,
      0,
    ),
  }
}
