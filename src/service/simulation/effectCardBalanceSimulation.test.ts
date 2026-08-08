import { describe, expect, it } from 'vitest'

import { combatConfig } from '../../configs/combatConfig'
import { effectCardConfig } from '../../configs/effectCardConfig'
import { mimicConfigs } from '../../configs/mimicConfigs'
import { roundConfig } from '../../configs/roundConfig'
import { spawnConfig } from '../../configs/spawnConfig'
import {
  simulateEffectCardCombat,
  type BalanceCombatMimic,
} from './effectCardBalanceSimulation'

function createMimic(
  id: number,
  x: number,
  hasThunderCard: boolean,
  spawnedAtMs = 0,
  mimicId: BalanceCombatMimic['mimicId'] = 'normal',
): BalanceCombatMimic {
  return {
    id,
    mimicId,
    role: 'regular',
    health: mimicConfigs[mimicId].maximumHealth,
    logicalX: x,
    logicalY: 100,
    jackpotPhase: null,
    spawnedAtMs,
    initialY: 100,
    hasThunderCard,
  }
}

describe('effect-card combat simulation', () => {
  const clickRate = 10
  const ownerHitCount = Math.ceil(
    mimicConfigs.normal.maximumHealth / combatConfig.initialWeaponDamage,
  )
  const separatedDistance =
    effectCardConfig.thunder.spriteSheet.frameWidthPixels +
    spawnConfig.cardWidthPixels

  it('applies only one thunder damage instance per strike', () => {
    const metrics = simulateEffectCardCombat(
      [
        createMimic(0, 100, true),
        createMimic(1, 100 + separatedDistance, false, 0, 'rare1'),
      ],
      ownerHitCount,
      clickRate,
      1,
      () => 0,
    )

    expect(metrics.thunderStrikesTriggered).toBe(
      effectCardConfig.thunder.initialStrikeCount,
    )
    expect(metrics.thunderDefeats).toBe(0)
  })

  it('queues a linked card behind its own windup', () => {
    const metrics = simulateEffectCardCombat(
      [
        createMimic(0, 100, true),
        createMimic(1, 100 + separatedDistance, true),
        createMimic(2, 100 + separatedDistance * 2, false),
      ],
      ownerHitCount,
      clickRate,
      1,
      () => 0,
    )

    expect(metrics.thunderDefeats).toBe(2)
    expect(metrics.thunderStrikesTriggered).toBe(
      effectCardConfig.thunder.initialStrikeCount * 2,
    )
    expect(metrics.maximumThunderChainDepth).toBe(2)
  })

  it('cancels a card whose windup would finish after the round timer', () => {
    const clickIntervalMs = 1_000 / clickRate
    const ownerSpawnMs =
      roundConfig.durationMs - ownerHitCount * clickIntervalMs
    const metrics = simulateEffectCardCombat(
      [
        createMimic(0, 100, true, ownerSpawnMs),
        createMimic(1, 100 + separatedDistance, false, ownerSpawnMs),
      ],
      Math.floor(roundConfig.durationMs / clickIntervalMs),
      clickRate,
      1,
      () => 0,
    )

    expect(metrics.defeatedByMimic.normal).toBe(1)
    expect(metrics.thunderStrikesTriggered).toBe(0)
  })

  it('includes a Jackpot card trigger in the ordinary combat timeline', () => {
    const clickIntervalMs = 1_000 / clickRate
    const triggerAtMs = clickIntervalMs * 2
    const metrics = simulateEffectCardCombat(
      [createMimic(0, 100, false)],
      1,
      clickRate,
      1,
      () => 0,
      [{ readyAtMs: triggerAtMs, chainDepth: 1 }],
    )

    expect(metrics.thunderStrikesTriggered).toBe(
      effectCardConfig.thunder.initialStrikeCount,
    )
    expect(metrics.thunderDefeats).toBe(1)
  })
})
