import { describe, expect, it } from 'vitest'

import { balanceSimulationConfig } from '../../../configs/balanceSimulationConfig'
import { effectCardConfig } from '../../../configs/effectCardConfig'
import { spawnConfig } from '../../../configs/spawnConfig'
import {
  advanceMeteoriteFlight,
  calculateExplosionDisplaySize,
  calculateMeteoriteDamageAreaSide,
  calculateMeteoriteDisplaySize,
  collectMeteoriteHitTargets,
  createMeteoriteLaunchOffsets,
  createMeteoriteTrajectory,
  selectMeteoriteLandingPoint,
} from './meteoriteRules'
import type { EffectAttackTarget } from './effectTargeting'

const field = {
  width: balanceSimulationConfig.field.widthPixels,
  height: balanceSimulationConfig.field.heightPixels,
}

describe('meteorite rules', () => {
  it('derives meteorite and explosion display sizes from the shared scale', () => {
    const config = effectCardConfig.meteorite

    expect(calculateMeteoriteDisplaySize()).toEqual({
      width: config.spriteSheet.frameWidthPixels * config.displayScale,
      height: config.spriteSheet.frameHeightPixels * config.displayScale,
    })
    expect(calculateExplosionDisplaySize()).toEqual({
      width:
        config.explosionSpriteSheet.frameWidthPixels * config.displayScale,
      height:
        config.explosionSpriteSheet.frameHeightPixels * config.displayScale,
    })
  })

  it('derives the damage square from displayed explosion width and its multiplier', () => {
    const config = effectCardConfig.meteorite
    const displayedExplosionWidth =
      config.explosionSpriteSheet.frameWidthPixels * config.displayScale

    expect(calculateMeteoriteDamageAreaSide()).toBe(
      displayedExplosionWidth * config.damageAreaWidthMultiplier,
    )
    expect(calculateMeteoriteDamageAreaSide(config.displayScale, 1.1)).toBe(
      displayedExplosionWidth * 1.1,
    )
  })

  it('rejects a non-positive damage area width multiplier', () => {
    expect(() =>
      calculateMeteoriteDamageAreaSide(
        effectCardConfig.meteorite.displayScale,
        0,
      ),
    ).toThrow('Meteorite damage area width multiplier must be greater than zero')
  })

  it('selects a landing point whose bottom-aligned damage square stays in bounds', () => {
    const side = calculateMeteoriteDamageAreaSide()

    expect(selectMeteoriteLandingPoint(field, sequenceRandom([0, 0]))).toEqual({
      x: side / 2,
      y: side,
    })
    const bottomRight = selectMeteoriteLandingPoint(
      field,
      sequenceRandom([1, 1]),
    )
    expect(bottomRight.x).toBeCloseTo(field.width - side / 2)
    expect(bottomRight.y).toBe(field.height)
  })

  it('starts fully outside the upper-right edge and travels down-left', () => {
    const landingPoint = { x: field.width / 2, y: field.height / 2 }
    const trajectory = createMeteoriteTrajectory(field, landingPoint)

    expect(trajectory.direction.x).toBeLessThan(0)
    expect(trajectory.direction.y).toBeGreaterThan(0)
    expect(trajectory.start.x).toBeGreaterThan(landingPoint.x)
    expect(trajectory.start.y).toBeLessThan(landingPoint.y)
    expect(
      isRotatedMeteoriteFullyOutside(field, trajectory.start),
    ).toBe(true)
  })

  it('clamps the final flight step to the landing point without overshooting', () => {
    const trajectory = createMeteoriteTrajectory(field, {
      x: field.width / 2,
      y: field.height / 2,
    })
    const progress = advanceMeteoriteFlight(
      {
        position: trajectory.start,
        remainingDistance: trajectory.distance,
      },
      Number.POSITIVE_INFINITY,
      trajectory.direction,
    )

    expect(progress.arrived).toBe(true)
    expect(progress.position.x).toBeCloseTo(trajectory.landing.x)
    expect(progress.position.y).toBeCloseTo(trajectory.landing.y)
    expect(progress.remainingDistance).toBe(0)
  })

  it('uses cumulative configurable intervals after an immediate first launch', () => {
    const { minimumLaunchIntervalMs, maximumLaunchIntervalMs } =
      effectCardConfig.meteorite
    const offsets = createMeteoriteLaunchOffsets(
      3,
      sequenceRandom([0, 1]),
    )

    expect(offsets).toEqual([
      0,
      minimumLaunchIntervalMs,
      minimumLaunchIntervalMs + maximumLaunchIntervalMs,
    ])
  })

  it('hits only eligible entities overlapping the bottom-aligned square', () => {
    const side = calculateMeteoriteDamageAreaSide()
    const landing = { x: 500, y: 500 }
    const inside = createTarget(1, landing.x, landing.y - side / 2)
    const overlappingEdge = createTarget(
      2,
      landing.x + side / 2 + spawnConfig.cardWidthPixels / 2,
      landing.y,
    )
    const below = createTarget(
      3,
      landing.x,
      landing.y + spawnConfig.cardHeightPixels / 2 + 1,
    )
    const ineligible = {
      ...createTarget(4, landing.x, landing.y),
      role: 'jackpot' as const,
      jackpotPhase: 'stunned' as const,
    }

    expect(
      collectMeteoriteHitTargets(
        [inside, overlappingEdge, below, ineligible],
        landing,
      ).map(({ id }) => id),
    ).toEqual([1, 2])
  })
})

function createTarget(
  id: number,
  logicalX: number,
  logicalY: number,
): EffectAttackTarget & { id: number } {
  return {
    id,
    role: 'regular',
    health: 10,
    logicalX,
    logicalY,
    jackpotPhase: null,
  }
}

function sequenceRandom(values: number[]): () => number {
  let index = 0
  return () => values[Math.min(index++, values.length - 1)]
}

function isRotatedMeteoriteFullyOutside(
  bounds: { width: number; height: number },
  anchor: { x: number; y: number },
): boolean {
  const sheet = effectCardConfig.meteorite.spriteSheet
  const displayScale = effectCardConfig.meteorite.displayScale
  const rotation = effectCardConfig.meteorite.rotationRadians
  const corners = [
    {
      x: -(sheet.frameWidthPixels * displayScale) / 2,
      y: -sheet.frameHeightPixels * displayScale,
    },
    {
      x: (sheet.frameWidthPixels * displayScale) / 2,
      y: -sheet.frameHeightPixels * displayScale,
    },
    { x: -(sheet.frameWidthPixels * displayScale) / 2, y: 0 },
    { x: (sheet.frameWidthPixels * displayScale) / 2, y: 0 },
  ].map(({ x, y }) => ({
    x: anchor.x + x * Math.cos(rotation) - y * Math.sin(rotation),
    y: anchor.y + x * Math.sin(rotation) + y * Math.cos(rotation),
  }))
  return (
    corners.every(({ x }) => x >= bounds.width) ||
    corners.every(({ y }) => y <= 0)
  )
}
