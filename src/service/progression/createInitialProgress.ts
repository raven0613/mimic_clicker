import type { ProgressData } from '../../types/game'

export function createInitialProgress(): ProgressData {
  return {
    schemaVersion: 1,
    completedRounds: 0,
    gold: 0,
    unlockedMimicIds: ['normal'],
    pendingUnlockMimicIds: [],
  }
}
