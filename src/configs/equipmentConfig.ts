export type EquipmentId = 'sword' | 'ring'
export type EquipmentRarity = 'normal' | 'sr'

export interface EquipmentDefinition {
  id: EquipmentId
  rarity: EquipmentRarity
  carrierSpawnChance: number
}

export const equipmentConfig = {
  initialSlotCount: 2,
  visibleAttachmentDropChance: 0.85,
  hiddenDropRarityChances: {
    none: 0.88,
    normal: 0.1,
    sr: 0.02,
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
    rarity: 'normal',
    carrierSpawnChance: equipmentConfig.sword.carrierSpawnChance,
  },
  {
    id: 'ring',
    rarity: 'sr',
    carrierSpawnChance: equipmentConfig.ring.carrierSpawnChance,
  },
] as const satisfies readonly EquipmentDefinition[]
