import type { ProgressData } from '../../types/game'
import { createInitialPermanentUpgradeLevels } from './permanentUpgrades'

export function createInitialProgress(): ProgressData {
  return {
    schemaVersion: 4,
    completedRounds: 0,
    gold: 0,
    unlockedMimicIds: ['normal'],
    pendingUnlockMimicIds: [],
    latestRoundResult: null,
    permanentUpgrades: createInitialPermanentUpgradeLevels(),
  }
}
