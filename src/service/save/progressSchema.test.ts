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
    expect(migrated.permanentUpgrades).toEqual(current.permanentUpgrades)
  })

  it('migrates a version 2 save with every permanent upgrade at level zero', () => {
    const current = createInitialProgress()
    const migrated = parseProgress({
      schemaVersion: 2,
      completedRounds: current.completedRounds,
      gold: current.gold,
      unlockedMimicIds: current.unlockedMimicIds,
      pendingUnlockMimicIds: current.pendingUnlockMimicIds,
      latestRoundResult: null,
    })

    expect(migrated.schemaVersion).toBe(current.schemaVersion)
    expect(migrated.permanentUpgrades).toEqual(current.permanentUpgrades)
  })

  it('rejects an automatic interval level before hover attack is unlocked', () => {
    const current = createInitialProgress()

    expect(() =>
      parseProgress({
        ...current,
        permanentUpgrades: {
          ...current.permanentUpgrades,
          hoverAutoAttackInterval: 1,
        },
      }),
    ).toThrow()
  })
})
