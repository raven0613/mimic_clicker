import type { JackpotOutcome, RoundResult } from '../../types/game'
import type { EquipmentSaleSummary } from './equipmentSale'

interface CreateRoundResultInput {
  combatGold: number
  equipmentSale: EquipmentSaleSummary
  defeatedMimics: number
  jackpotOutcome: JackpotOutcome
}

export function createRoundResult(
  input: CreateRoundResultInput,
): RoundResult {
  const combatGold = Math.max(0, Math.floor(input.combatGold))
  return {
    combatGold,
    equipmentSaleGold: input.equipmentSale.totalGold,
    totalGold: combatGold + input.equipmentSale.totalGold,
    equipmentSales: input.equipmentSale.groups.map((group) => ({ ...group })),
    defeatedMimics: Math.max(0, Math.floor(input.defeatedMimics)),
    jackpotOutcome: input.jackpotOutcome,
  }
}
