interface WeaponDefinitionConfig {
  id: string
  displayName: string
  baseDamage: number
  priceGold: number
  requiredWeaponId: string | null
}

const definitions = [
  {
    id: 'travelerHammer',
    displayName: '旅行者木槌',
    baseDamage: 10,
    priceGold: 0,
    requiredWeaponId: null,
  },
  {
    id: 'lockbreakerHammer',
    displayName: '破鎖鐵鎚',
    baseDamage: 25,
    priceGold: 3_000,
    requiredWeaponId: 'travelerHammer',
  },
  {
    id: 'runicSiegeHammer',
    displayName: '符文破城鎚',
    baseDamage: 65,
    priceGold: 12_000,
    requiredWeaponId: 'lockbreakerHammer',
  },
] as const satisfies readonly WeaponDefinitionConfig[]

export const weaponConfig = {
  initialWeaponId: 'travelerHammer',
  definitions,
} as const

export type WeaponDefinition = (typeof definitions)[number]
export type WeaponId = WeaponDefinition['id']
