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
    spawnWeight: 65,
  },
  rare1: {
    maximumHealth: 50,
    baseReward: 18,
    spawnWeight: 25,
  },
  rare2: {
    maximumHealth: 125,
    baseReward: 50,
    spawnWeight: 10,
  },
}
