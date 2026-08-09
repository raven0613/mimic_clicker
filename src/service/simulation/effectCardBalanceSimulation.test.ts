import { describe, expect, it } from 'vitest'

import { combatConfig } from '../../configs/combatConfig'
import { balanceSimulationConfig } from '../../configs/balanceSimulationConfig'
import { effectCardConfig } from '../../configs/effectCardConfig'
import { equipmentConfig } from '../../configs/equipmentConfig'
import { mimicConfigs } from '../../configs/mimicConfigs'
import { roundConfig } from '../../configs/roundConfig'
import { spawnConfig } from '../../configs/spawnConfig'
import { clearRefillConfig } from '../../configs/clearRefillConfig'
import type { EffectCardId } from '../game/attachedCards/attachedCardRules'
import {
  calculateMeteoriteDamageAreaSide,
  createMeteoriteTrajectory,
} from '../game/effectCards/meteoriteRules'
import {
  calculateInitialTornadoDamage,
  calculateInitialThunderDamage,
} from '../game/effectCards/effectCardRules'
import {
  simulateEffectCardCombat,
  type BalanceCombatMimic,
} from './effectCardBalanceSimulation'

function createMimic(
  id: number,
  x: number,
  effectCardIds: EffectCardId[],
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
    effectCardIds,
    visibleEquipmentIds: [],
    hiddenEquipmentId: null,
  }
}

describe('effect-card combat simulation', () => {
  const clickRate =
    1_000 / combatConfig.minimumWeaponDamageIntervalPerTargetMs
  const ownerHitCount = Math.ceil(
    mimicConfigs.normal.maximumHealth / combatConfig.initialWeaponDamage,
  )
  const separatedDistance =
    effectCardConfig.thunder.spriteSheet.frameWidthPixels +
    spawnConfig.cardWidthPixels

  it('applies only one thunder damage instance per strike', () => {
    const metrics = simulateEffectCardCombat(
      [
        createMimic(0, 100, ['thunder']),
        createMimic(1, 100 + separatedDistance, [], 0, 'rare1'),
      ],
      ownerHitCount,
      clickRate,
      1,
      () => 0,
    )

    expect(metrics.thunderStrikesTriggered).toBe(
      effectCardConfig.thunder.initialStrikeCount,
    )
    expect(metrics.defeats.thunder).toBe(0)
  })

  it('queues a linked card behind its own windup', () => {
    const metrics = simulateEffectCardCombat(
      [
        createMimic(0, 100, ['thunder']),
        createMimic(1, 100 + separatedDistance, ['thunder']),
        createMimic(2, 100 + separatedDistance * 2, []),
      ],
      ownerHitCount,
      clickRate,
      1,
      () => 0,
    )

    expect(metrics.defeats.thunder).toBe(2)
    expect(metrics.thunderStrikesTriggered).toBe(
      effectCardConfig.thunder.initialStrikeCount * 2,
    )
    expect(metrics.maximumEffectChainDepth).toBe(2)
  })

  it('cancels a card whose windup would finish after the round timer', () => {
    const clickIntervalMs = 1_000 / clickRate
    const ownerSpawnMs =
      roundConfig.durationMs - ownerHitCount * clickIntervalMs
    const metrics = simulateEffectCardCombat(
      [
        createMimic(0, 100, ['thunder'], ownerSpawnMs),
        createMimic(1, 100 + separatedDistance, [], ownerSpawnMs),
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
      [createMimic(0, 100, [])],
      1,
      clickRate,
      1,
      () => 0,
      [{ id: 'thunder', readyAtMs: triggerAtMs, chainDepth: 1 }],
    )

    expect(metrics.thunderStrikesTriggered).toBe(
      effectCardConfig.thunder.initialStrikeCount,
    )
    expect(metrics.defeats.thunder).toBe(1)
  })

  it('applies meteorite damage once at impact and queues linked cards', () => {
    const side = calculateMeteoriteDamageAreaSide()
    const field = {
      width: balanceSimulationConfig.field.widthPixels,
      height: balanceSimulationConfig.field.heightPixels,
    }
    const landing = { x: field.width / 2, y: field.height * 0.7 }
    const trajectory = createMeteoriteTrajectory(field, landing)
    const impactAtMs =
      trajectory.distance /
      effectCardConfig.meteorite.flightSpeedPixelsPerSecond *
      1_000
    const movementSpeed =
      (field.height + spawnConfig.cardHeightPixels * 2) /
      (roundConfig.mimicFieldTravelDurationMs / 1_000)
    const target = createMimic(0, landing.x, ['thunder'])
    target.initialY =
      landing.y - side / 2 - movementSpeed * (impactAtMs / 1_000)
    target.logicalY = target.initialY

    const survivor = createMimic(1, 100, [], 0, 'rare2')
    survivor.initialY = target.initialY
    survivor.logicalY = target.logicalY
    const metrics = simulateEffectCardCombat(
      [target, survivor],
      0,
      clickRate,
      1,
      () => 0,
      [
        {
          id: 'meteorite',
          readyAtMs: 0,
          chainDepth: 1,
          meteoriteLandings: Array.from(
            { length: effectCardConfig.meteorite.initialMeteoriteCount },
            () => landing,
          ),
          meteoriteLaunchOffsetsMs: Array.from(
            { length: effectCardConfig.meteorite.initialMeteoriteCount },
            () => 0,
          ),
        },
      ],
    )

    expect(metrics.cardsTriggered.meteorite).toBe(1)
    expect(metrics.meteoriteImpacts).toBe(
      effectCardConfig.meteorite.initialMeteoriteCount,
    )
    expect(metrics.attackHits.meteorite).toBe(1)
    expect(metrics.defeats.meteorite).toBe(1)
    expect(metrics.cardsTriggered.thunder).toBe(1)
    expect(metrics.maximumEffectChainDepth).toBe(2)
  })

  it('cancels a meteorite that would land after the round timer', () => {
    const metrics = simulateEffectCardCombat(
      [createMimic(0, 640, [])],
      0,
      clickRate,
      1,
      () => 0.5,
      [
        {
          id: 'meteorite',
          readyAtMs: roundConfig.durationMs - 1,
          chainDepth: 1,
        },
      ],
    )

    expect(metrics.cardsTriggered.meteorite).toBe(1)
    expect(metrics.meteoritesLaunched).toBe(1)
    expect(metrics.meteoriteImpacts).toBe(0)
    expect(metrics.attackHits.meteorite).toBe(0)
  })

  it('simulates moving tornado contact damage and linked-card windup', () => {
    const target = createMimic(
      0,
      balanceSimulationConfig.field.widthPixels / 2,
      ['thunder'],
    )
    target.initialY = balanceSimulationConfig.field.heightPixels / 2
    target.logicalY = target.initialY
    target.health = calculateInitialTornadoDamage()

    const metrics = simulateEffectCardCombat(
      [target],
      0,
      clickRate,
      1,
      () => 0.25,
      [
        {
          id: 'tornado',
          readyAtMs: 0,
          chainDepth: 1,
          sourcePosition: {
            x: target.logicalX,
            y: target.logicalY,
          },
        },
      ],
    )

    expect(metrics.cardsTriggered.tornado).toBe(1)
    expect(metrics.tornadoesSpawned).toBe(
      effectCardConfig.tornado.initialTornadoCount,
    )
    expect(metrics.attackHits.tornado).toBe(1)
    expect(metrics.defeats.tornado).toBe(1)
    expect(metrics.cardsTriggered.thunder).toBe(1)
    expect(metrics.maximumEffectChainDepth).toBe(2)
  })

  it('does not apply tornado run damage after the round timer', () => {
    const target = createMimic(0, 640, [])
    const metrics = simulateEffectCardCombat(
      [target],
      0,
      clickRate,
      1,
      () => 0.25,
      [
        {
          id: 'tornado',
          readyAtMs:
            roundConfig.durationMs -
            effectCardConfig.tornado.startAnimationDurationMs,
          chainDepth: 1,
          sourcePosition: { x: target.logicalX, y: target.logicalY },
        },
      ],
    )

    expect(metrics.cardsTriggered.tornado).toBe(1)
    expect(metrics.attackHits.tornado).toBe(0)
  })

  it('does not trigger a card whose windup completes exactly at round end', () => {
    const metrics = simulateEffectCardCombat(
      [createMimic(0, 100, [])],
      0,
      clickRate,
      1,
      () => 0,
      [
        {
          id: 'thunder',
          readyAtMs: roundConfig.durationMs,
          chainDepth: 1,
        },
      ],
    )

    expect(metrics.cardsTriggered.thunder).toBe(0)
    expect(metrics.thunderStrikesTriggered).toBe(0)
  })

  it('limits weapon damage frequency per target in the combat simulation', () => {
    const attemptIntervalMs =
      combatConfig.minimumWeaponDamageIntervalPerTargetMs / 2
    const rapidClickRate = 1_000 / attemptIntervalMs
    const requiredAcceptedHits = 2
    const attemptsRequired = requiredAcceptedHits * 2 - 1
    const createIntervalTarget = () => {
      const target = createMimic(0, 100, [])
      target.health = combatConfig.initialWeaponDamage * requiredAcceptedHits
      return target
    }
    const beforeEnoughAcceptedHits = simulateEffectCardCombat(
      [createIntervalTarget()],
      attemptsRequired - 1,
      rapidClickRate,
      1,
      () => 0,
    )
    const afterEnoughAcceptedHits = simulateEffectCardCombat(
      [createIntervalTarget()],
      attemptsRequired,
      rapidClickRate,
      1,
      () => 0,
    )

    expect(beforeEnoughAcceptedHits.defeatedByMimic.normal).toBe(0)
    expect(afterEnoughAcceptedHits.defeatedByMimic.normal).toBe(1)
  })

  it('does not apply the weapon interval to effect-card damage', () => {
    const attemptIntervalMs =
      combatConfig.minimumWeaponDamageIntervalPerTargetMs / 2
    const target = createMimic(0, 100, [])
    target.health =
      combatConfig.initialWeaponDamage + calculateInitialThunderDamage()
    const metrics = simulateEffectCardCombat(
      [target],
      2,
      1_000 / attemptIntervalMs,
      1,
      () => 0,
      [
        {
          id: 'thunder',
          readyAtMs: attemptIntervalMs * 1.5,
          chainDepth: 1,
        },
      ],
    )

    expect(metrics.defeats.thunder).toBe(1)
  })

  it('refills through the shared field fill after a confirmed full clear', () => {
    const metrics = simulateEffectCardCombat(
      [createMimic(0, 100, [])],
      ownerHitCount,
      clickRate,
      1,
      () => 0.5,
    )

    expect(metrics.fullClearCount).toBe(1)
    expect(metrics.refillCount).toBe(1)
    expect(metrics.refilledMimicCount).toBeGreaterThan(0)
    expect(metrics.emptyFieldDurationsMs).toEqual([
      clearRefillConfig.confirmationDelayMs,
    ])
    expect(metrics.repeatedRefillsWithoutInterventionCount).toBe(0)
  })

  it('includes configured Ring strikes in the clear-refill combat timeline', () => {
    const createRingTarget = () => {
      const target = createMimic(0, 100, [])
      target.health =
        combatConfig.initialWeaponDamage *
        (equipmentConfig.ring.acceptedManualHitsPerTrigger + 1)
      return target
    }
    const clickBudget = equipmentConfig.ring.acceptedManualHitsPerTrigger
    const withoutRing = simulateEffectCardCombat(
      [createRingTarget()],
      clickBudget,
      clickRate,
      1,
      () => 0.5,
    )
    const withRing = simulateEffectCardCombat(
      [createRingTarget()],
      clickBudget,
      clickRate,
      1,
      () => 0.5,
      [],
      combatConfig.initialWeaponDamage,
      1,
    )

    expect(withoutRing.defeatedByMimic.normal).toBe(0)
    expect(withRing.defeatedByMimic.normal).toBe(1)
  })
})
