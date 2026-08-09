import { describe, expect, it } from 'vitest'

import { settlementConfig } from '../../configs/settlementConfig'
import {
  equipmentDefinitions,
  type EquipmentId,
} from '../../configs/equipmentConfig'
import { calculateEquipmentSale } from './equipmentSale'

const rarityByEquipmentId = new Map(
  equipmentDefinitions.map(({ id, rarity }) => [id, rarity]),
)

function expectedUnitPrice(equipmentId: EquipmentId): number {
  const rarity = rarityByEquipmentId.get(equipmentId)
  if (!rarity) throw new Error(`Missing test rarity for ${equipmentId}`)
  return Math.round(
    settlementConfig.equipmentSale.basePriceGold *
      settlementConfig.equipmentSale.rarityPriceMultipliers[rarity],
  )
}

describe('equipment settlement sale', () => {
  it('groups duplicate ids and returns multiplied subtotals without merging rarities', () => {
    const sale = calculateEquipmentSale(['sword', 'ring', 'sword'])
    const swordPrice = expectedUnitPrice('sword')
    const ringPrice = expectedUnitPrice('ring')

    expect(sale.groups).toEqual([
      {
        equipmentId: 'sword',
        quantity: 2,
        unitPriceGold: swordPrice,
        subtotalGold: swordPrice * 2,
      },
      {
        equipmentId: 'ring',
        quantity: 1,
        unitPriceGold: ringPrice,
        subtotalGold: ringPrice,
      },
    ])
    expect(sale.totalGold).toBe(swordPrice * 2 + ringPrice)
  })

  it('returns an empty zero-value sale when no equipment was obtained', () => {
    expect(calculateEquipmentSale([])).toEqual({ groups: [], totalGold: 0 })
  })
})
