import { describe, expect, it } from 'vitest'

import { mimicConfigs } from '../../configs/mimicConfigs'
import { createInitialProgress } from './createInitialProgress'
import {
  acknowledgeUnlock,
  calculateJackpotReward,
  completeRound,
  getAvailableMimicIds,
} from './progression'

describe('progression', () => {
  it('starts with only the normal mimic unlocked', () => {
    const progress = createInitialProgress()

    expect(progress.completedRounds).toBe(0)
    expect(progress.unlockedMimicIds).toEqual(['normal'])
    expect(progress.pendingUnlockMimicIds).toEqual([])
  })

  it('unlocks rare1 and rare2 after the first two completed rounds', () => {
    const initial = createInitialProgress()
    const afterFirst = completeRound(initial, {
      earnedGold: mimicConfigs.normal.baseReward,
      defeatedMimics: 1,
      jackpotOutcome: 'escaped',
    })
    const afterSecond = completeRound(afterFirst.progress, {
      earnedGold: mimicConfigs.rare1.baseReward,
      defeatedMimics: 1,
      jackpotOutcome: 'defeated',
    })

    expect(afterFirst.newUnlockMimicId).toBe('rare1')
    expect(afterFirst.progress.pendingUnlockMimicIds).toEqual(['rare1'])
    expect(getAvailableMimicIds(afterFirst.progress)).toEqual(['normal', 'rare1'])
    expect(afterSecond.newUnlockMimicId).toBe('rare2')
    expect(afterSecond.progress.pendingUnlockMimicIds).toEqual(['rare1', 'rare2'])
    expect(getAvailableMimicIds(afterSecond.progress)).toEqual([
      'normal',
      'rare1',
      'rare2',
    ])
  })

  it('removes only the acknowledged unlock announcement', () => {
    const first = completeRound(createInitialProgress(), {
      earnedGold: 0,
      defeatedMimics: 0,
      jackpotOutcome: 'notRevealed',
    })

    const acknowledged = acknowledgeUnlock(first.progress, 'rare1')

    expect(acknowledged.pendingUnlockMimicIds).toEqual([])
    expect(acknowledged.unlockedMimicIds).toContain('rare1')
  })

  it('scales the Jackpot reward from the highest available base reward', () => {
    const normalOnlyReward = calculateJackpotReward(['normal'])
    const allMimicsReward = calculateJackpotReward(['normal', 'rare1', 'rare2'])

    expect(allMimicsReward).toBeGreaterThan(normalOnlyReward)
    expect(allMimicsReward).toBeGreaterThanOrEqual(
      mimicConfigs.rare2.baseReward,
    )
  })
})
