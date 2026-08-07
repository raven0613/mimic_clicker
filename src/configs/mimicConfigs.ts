import type { MimicId } from '../types/game'

export interface MimicConfig {
  maximumHealth: number
  baseReward: number
  spawnWeight: number
}

export const mimicConfigs: Record<MimicId, MimicConfig> = {
  normal: {
    maximumHealth: 20,
    baseReward: 5,
    spawnWeight: 70,
  },
  rare1: {
    maximumHealth: 40,
    baseReward: 14,
    spawnWeight: 23,
  },
  rare2: {
    maximumHealth: 70,
    baseReward: 30,
    spawnWeight: 7,
  },
}
