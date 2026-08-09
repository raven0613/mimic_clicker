import type { ProgressData } from '../../types/game'
import { createInitialPermanentUpgradeLevels } from './permanentUpgrades'

export function createInitialProgress(): ProgressData {
  return {
    schemaVersion: 3,
    completedRounds: 0,
    gold: 0,
    unlockedMimicIds: ['normal'],
    pendingUnlockMimicIds: [],
    latestRoundResult: null,
    permanentUpgrades: createInitialPermanentUpgradeLevels(),
  }
}
