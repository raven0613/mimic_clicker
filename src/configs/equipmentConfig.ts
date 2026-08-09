import type { AttachedCardRarity } from './attachedCardConfig'

export type EquipmentId = 'sword' | 'ring'

export interface EquipmentDefinition {
  id: EquipmentId
  displayName: string
  rarity: AttachedCardRarity
  carrierSpawnChance: number
}

export const equipmentConfig = {
  initialSlotCount: 2,
  visibleAttachmentDropChance: 0.85,
  hiddenDropRarityChances: {
    none: 0.88,
    N: 0.1,
    R: 0,
    SR: 0.02,
    SSR: 0,
    UR: 0,
  },
  sword: {
    carrierSpawnChance: 0.07,
    weaponDamageBonus: 5,
  },
  ring: {
    carrierSpawnChance: 0.03,
    acceptedManualHitsPerTrigger: 5,
    additionalDamageMultiplier: 1,
    additionalHitIntervalMs: 200,
    additionalHitEffectOffset: {
      x: 28,
      y: -22,
    },
    additionalHitEffectTintColor: '#ff825c',
  },
} as const

export const equipmentDefinitions = [
  {
    id: 'sword',
    displayName: 'Sword',
    rarity: 'N',
    carrierSpawnChance: equipmentConfig.sword.carrierSpawnChance,
  },
  {
    id: 'ring',
    displayName: 'Ring',
    rarity: 'SR',
    carrierSpawnChance: equipmentConfig.ring.carrierSpawnChance,
  },
] as const satisfies readonly EquipmentDefinition[]
