import { describe, expect, it } from 'vitest'

import { createInitialProgress } from '../progression/createInitialProgress'
import { parseProgress } from './progressSchema'

describe('progress schema migration', () => {
  it('migrates a version 1 save without inventing a completed settlement', () => {
    const current = createInitialProgress()
    const migrated = parseProgress({
      schemaVersion: 1,
      completedRounds: current.completedRounds,
      gold: current.gold,
      unlockedMimicIds: current.unlockedMimicIds,
      pendingUnlockMimicIds: current.pendingUnlockMimicIds,
    })

    expect(migrated.schemaVersion).toBe(current.schemaVersion)
    expect(migrated.latestRoundResult).toBeNull()
  })
})
