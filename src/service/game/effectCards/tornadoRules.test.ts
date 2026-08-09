import { describe, expect, it } from 'vitest'

import { effectCardConfig } from '../../../configs/effectCardConfig'
import { spawnConfig } from '../../../configs/spawnConfig'
import type { EffectAttackTarget } from './effectTargeting'
import {
  advanceTornadoRunMotion,
  advanceTornadoStraightMotion,
  calculateTornadoDamageArea,
  calculateTornadoDisplaySize,
  clampTornadoSpawnPosition,
  collectTornadoHitTargets,
  createTornadoInitialDirections,
  type TornadoMotionState,
} from './tornadoRules'

const field = { width: 1_280, height: 720 }

describe('tornado rules', () => {
  it('derives display and bottom-aligned damage dimensions from config', () => {
    const config = effectCardConfig.tornado
    const displaySize = calculateTornadoDisplaySize()
    const area = calculateTornadoDamageArea({ x: 500, y: 400 })

    expect(displaySize).toEqual({
      width: config.spriteSheets.run.frameWidthPixels * config.displayScale,
      height: config.spriteSheets.run.frameHeightPixels * config.displayScale,
    })
    expect(area).toEqual({
      x: 500 - displaySize.width / 2,
      y:
        400 -
        config.spriteSheets.run.frameHeightPixels *
          config.displayScale *
          config.damageAreaHeightRatio,
      width: displaySize.width,
      height:
        config.spriteSheets.run.frameHeightPixels *
        config.displayScale *
        config.damageAreaHeightRatio,
    })
  })

  it('spreads multiple initial directions around the full circle', () => {
    const directions = createTornadoInitialDirections(4, () => 0.5)
    const angles = directions.map(({ x, y }) => Math.atan2(y, x))

    expect(directions).toHaveLength(4)
    for (let index = 0; index < directions.length; index += 1) {
      const nextIndex = (index + 1) % directions.length
      expect(
        normalizedAngle(angles[nextIndex] - angles[index]),
      ).toBeCloseTo(Math.PI / 2)
    }
  })

  it('clamps the bottom anchor so the displayed tornado starts in bounds', () => {
    const displaySize = calculateTornadoDisplaySize()

    expect(clampTornadoSpawnPosition({ x: 0, y: 0 }, field)).toEqual({
      x: displaySize.width / 2,
      y: displaySize.height,
    })
    expect(
      clampTornadoSpawnPosition(
        { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY },
        field,
      ),
    ).toEqual({
      x: field.width - displaySize.width / 2,
      y: field.height,
    })
  })

  it('keeps moving during straight phases and reflects inside the field', () => {
    const start = clampTornadoSpawnPosition(
      { x: field.width - 1, y: field.height / 2 },
      field,
    )
    const result = advanceTornadoStraightMotion(
      { position: start, direction: { x: 1, y: 0 } },
      1_000,
      field,
    )

    expect(result.position.x).toBeLessThanOrEqual(
      field.width - calculateTornadoDisplaySize().width / 2,
    )
    expect(result.direction.x).toBeLessThan(0)
    expect(result.position.y).toBe(start.y)
  })

  it('uses injected randomness for repeatable run turns', () => {
    const state: TornadoMotionState = {
      position: { x: field.width / 2, y: field.height / 2 },
      direction: { x: 1, y: 0 },
      remainingTurnMs: 0,
    }
    const first = advanceTornadoRunMotion(
      state,
      effectCardConfig.tornado.minimumTurnIntervalMs / 2,
      field,
      sequenceRandom([1, 0]),
    )
    const second = advanceTornadoRunMotion(
      state,
      effectCardConfig.tornado.minimumTurnIntervalMs / 2,
      field,
      sequenceRandom([1, 0]),
    )

    expect(first).toEqual(second)
    expect(first.direction).not.toEqual(state.direction)
    expect(first.remainingTurnMs).toBeGreaterThan(0)
  })

  it('hits only eligible targets overlapping the configured damage rectangle', () => {
    const anchor = { x: 500, y: 500 }
    const area = calculateTornadoDamageArea(anchor)
    const inside = createTarget(1, anchor.x, anchor.y - area.height / 2)
    const edge = createTarget(
      2,
      anchor.x + area.width / 2 + spawnConfig.cardWidthPixels / 2,
      anchor.y,
    )
    const below = createTarget(
      3,
      anchor.x,
      anchor.y + spawnConfig.cardHeightPixels / 2 + 1,
    )
    const stunnedJackpot = {
      ...createTarget(4, anchor.x, anchor.y),
      role: 'jackpot' as const,
      jackpotPhase: 'stunned' as const,
    }

    expect(
      collectTornadoHitTargets(
        [inside, edge, below, stunnedJackpot],
        anchor,
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

function normalizedAngle(angle: number): number {
  const fullCircle = Math.PI * 2
  return ((angle % fullCircle) + fullCircle) % fullCircle
}

function sequenceRandom(values: number[]): () => number {
  let index = 0
  return () => values[Math.min(index++, values.length - 1)]
}
