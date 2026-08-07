import 'fake-indexeddb/auto'

import { describe, expect, it } from 'vitest'

import { mimicConfigs } from '../../configs/mimicConfigs'
import type { ProgressData } from '../../types/game'
import { completeRound } from '../progression/progression'
import { createInitialProgress } from '../progression/createInitialProgress'
import { createSaveRepository } from './saveRepository'

let databaseSequence = 0

function createRepository() {
  const databaseName = `mimic-clicker-test-${databaseSequence}`
  databaseSequence += 1
  return createSaveRepository(databaseName)
}

describe('save repository', () => {
  it('creates and persists the initial progress when no save exists', async () => {
    const repository = createRepository()

    const progress = await repository.loadOrCreate()
    const reloaded = await repository.loadOrCreate()

    expect(reloaded).toEqual(progress)
    expect(reloaded.unlockedMimicIds).toEqual(['normal'])
  })

  it('persists a completed round and its pending unlock together', async () => {
    const repository = createRepository()
    const initial = await repository.loadOrCreate()
    const settlement = completeRound(initial, {
      earnedGold: mimicConfigs.normal.baseReward,
      defeatedMimics: 1,
      jackpotOutcome: 'escaped',
    })

    await repository.replace(settlement.progress)

    expect(await repository.loadOrCreate()).toEqual(settlement.progress)
  })

  it('resets to a new initial progress document', async () => {
    const repository = createRepository()
    const initial = await repository.loadOrCreate()
    const settlement = completeRound(initial, {
      earnedGold: mimicConfigs.normal.baseReward,
      defeatedMimics: 1,
      jackpotOutcome: 'defeated',
    })
    await repository.replace(settlement.progress)

    const reset = await repository.reset()

    expect(reset.completedRounds).toBe(0)
    expect(reset.gold).toBe(0)
    expect(reset.unlockedMimicIds).toEqual(['normal'])
  })

  it('rejects progression that contradicts the fixed unlock sequence', async () => {
    const repository = createRepository()
    const initial = await repository.loadOrCreate()
    const inconsistent: ProgressData = {
      ...createInitialProgress(),
      unlockedMimicIds: ['normal', 'rare2'],
    }

    await expect(repository.replace(inconsistent)).rejects.toThrow()
    expect(await repository.loadOrCreate()).toEqual(initial)
  })
})
