import { jackpotConfig } from '../../configs/jackpotConfig'
import { mimicConfigs } from '../../configs/mimicConfigs'
import { mimicIds, type MimicId, type ProgressData, type RoundResult } from '../../types/game'

interface CompletedRound {
  progress: ProgressData
  newUnlockMimicId: MimicId | null
}

const unlockByCompletedRound: Partial<Record<number, MimicId>> = {
  1: 'rare1',
  2: 'rare2',
}

export function getAvailableMimicIds(progress: ProgressData): MimicId[] {
  const unlocked = new Set(progress.unlockedMimicIds)
  return mimicIds.filter((mimicId) => unlocked.has(mimicId))
}

export function completeRound(
  progress: ProgressData,
  result: RoundResult,
): CompletedRound {
  const completedRounds = progress.completedRounds + 1
  const unlockCandidate = unlockByCompletedRound[completedRounds] ?? null
  const isNewUnlock =
    unlockCandidate !== null &&
    !progress.unlockedMimicIds.includes(unlockCandidate)
  const newUnlockMimicId = isNewUnlock ? unlockCandidate : null

  return {
    progress: {
      ...progress,
      completedRounds,
      gold: progress.gold + Math.max(0, Math.floor(result.earnedGold)),
      unlockedMimicIds: newUnlockMimicId
        ? [...progress.unlockedMimicIds, newUnlockMimicId]
        : [...progress.unlockedMimicIds],
      pendingUnlockMimicIds: newUnlockMimicId
        ? [...progress.pendingUnlockMimicIds, newUnlockMimicId]
        : [...progress.pendingUnlockMimicIds],
    },
    newUnlockMimicId,
  }
}

export function acknowledgeUnlock(
  progress: ProgressData,
  mimicId: MimicId,
): ProgressData {
  return {
    ...progress,
    unlockedMimicIds: [...progress.unlockedMimicIds],
    pendingUnlockMimicIds: progress.pendingUnlockMimicIds.filter(
      (pendingMimicId) => pendingMimicId !== mimicId,
    ),
  }
}

export function calculateJackpotReward(mimicPool: MimicId[]): number {
  if (mimicPool.length === 0) {
    throw new Error('Cannot calculate Jackpot reward for an empty mimic pool')
  }

  const highestBaseReward = Math.max(
    ...mimicPool.map((mimicId) => mimicConfigs[mimicId].baseReward),
  )
  return Math.round(highestBaseReward * jackpotConfig.rewardMultiplier)
}
