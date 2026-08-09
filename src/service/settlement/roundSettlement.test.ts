import { describe, expect, it } from 'vitest'

import { mimicConfigs } from '../../configs/mimicConfigs'
import { calculateEquipmentSale } from './equipmentSale'
import { createRoundResult } from './roundSettlement'

describe('round settlement', () => {
  it('combines combat and equipment sale income into one immutable result', () => {
    const combatGold = mimicConfigs.normal.baseReward
    const equipmentSale = calculateEquipmentSale(['sword', 'ring'])
    const result = createRoundResult({
      combatGold,
      equipmentSale,
      defeatedMimics: 1,
      jackpotOutcome: 'defeated',
    })

    expect(result.combatGold).toBe(combatGold)
    expect(result.equipmentSaleGold).toBe(equipmentSale.totalGold)
    expect(result.totalGold).toBe(combatGold + equipmentSale.totalGold)
    expect(result.equipmentSales).toEqual(equipmentSale.groups)
    expect(result.equipmentSales).not.toBe(equipmentSale.groups)
  })
})
