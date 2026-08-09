import { effectCardConfig } from '../../../configs/effectCardConfig'
import { spawnConfig } from '../../../configs/spawnConfig'
import type {
  RandomSource,
  RectangleBounds,
  Vector2,
} from '../../../types/game'
import { calculateSpriteDisplaySize } from '../effects/spriteDisplaySize'
import {
  isEligibleEffectAttackTarget,
  type EffectAttackTarget,
} from './effectTargeting'

interface FieldSize {
  width: number
  height: number
}

interface StraightMotionState {
  position: Vector2
  direction: Vector2
}

export interface TornadoMotionState extends StraightMotionState {
  remainingTurnMs: number
}

export function calculateTornadoDisplaySize(
  displayScale: number = effectCardConfig.tornado.displayScale,
): { width: number; height: number } {
  const sheet = effectCardConfig.tornado.spriteSheets.run
  return calculateSpriteDisplaySize(
    sheet.frameWidthPixels,
    sheet.frameHeightPixels,
    displayScale,
  )
}

export function calculateTornadoDamageArea(
  anchor: Vector2,
  displayScale: number = effectCardConfig.tornado.displayScale,
  heightRatio: number = effectCardConfig.tornado.damageAreaHeightRatio,
): RectangleBounds {
  if (!Number.isFinite(heightRatio) || heightRatio <= 0) {
    throw new Error(
      `Tornado damage area height ratio must be greater than zero, received ${heightRatio}`,
    )
  }
  const displaySize = calculateTornadoDisplaySize(displayScale)
  const height = displaySize.height * heightRatio
  return {
    x: anchor.x - displaySize.width / 2,
    y: anchor.y - height,
    width: displaySize.width,
    height,
  }
}

export function collectTornadoHitTargets<T extends EffectAttackTarget>(
  targets: readonly T[],
  anchor: Vector2,
): T[] {
  const area = calculateTornadoDamageArea(anchor)
  const targetHalfWidth = spawnConfig.cardWidthPixels / 2
  const targetHalfHeight = spawnConfig.cardHeightPixels / 2
  return targets.filter(
    (target) =>
      isEligibleEffectAttackTarget(target) &&
      target.logicalX + targetHalfWidth >= area.x &&
      target.logicalX - targetHalfWidth <= area.x + area.width &&
      target.logicalY + targetHalfHeight >= area.y &&
      target.logicalY - targetHalfHeight <= area.y + area.height,
  )
}

export function createTornadoInitialDirections(
  count: number,
  random: RandomSource,
): Vector2[] {
  const normalizedCount = Math.max(0, Math.floor(count))
  if (normalizedCount === 0) return []
  const fullCircle = Math.PI * 2
  const baseAngle = clampUnit(random()) * fullCircle
  return Array.from({ length: normalizedCount }, (_, index) => {
    const jitter =
      normalizedCount === 1
        ? 0
        : signedUnit(random()) *
          effectCardConfig.tornado.multipleSpawnDirectionJitterRadians
    const angle = baseAngle + index * (fullCircle / normalizedCount) + jitter
    return { x: Math.cos(angle), y: Math.sin(angle) }
  })
}

export function clampTornadoSpawnPosition(
  position: Vector2,
  field: FieldSize,
): Vector2 {
  const bounds = getTornadoAnchorBounds(field)
  return {
    x: clamp(position.x, bounds.minimumX, bounds.maximumX),
    y: clamp(position.y, bounds.minimumY, bounds.maximumY),
  }
}

export function advanceTornadoStraightMotion(
  state: StraightMotionState,
  deltaMs: number,
  field: FieldSize,
): StraightMotionState {
  const direction = normalizeDirection(state.direction)
  const distance =
    effectCardConfig.tornado.movementSpeedPixelsPerSecond *
    (Math.max(0, deltaMs) / 1_000)
  const bounds = getTornadoAnchorBounds(field)
  const horizontal = advanceReflectedAxis(
    state.position.x,
    direction.x * distance,
    direction.x,
    bounds.minimumX,
    bounds.maximumX,
  )
  const vertical = advanceReflectedAxis(
    state.position.y,
    direction.y * distance,
    direction.y,
    bounds.minimumY,
    bounds.maximumY,
  )
  return {
    position: { x: horizontal.position, y: vertical.position },
    direction: normalizeDirection({
      x: horizontal.directionComponent,
      y: vertical.directionComponent,
    }),
  }
}

export function advanceTornadoRunMotion(
  state: TornadoMotionState,
  deltaMs: number,
  field: FieldSize,
  random: RandomSource,
): TornadoMotionState {
  let remainingMs = Math.max(0, deltaMs)
  let current: TornadoMotionState = {
    position: { ...state.position },
    direction: normalizeDirection(state.direction),
    remainingTurnMs: Math.max(0, state.remainingTurnMs),
  }
  while (remainingMs > 0) {
    if (current.remainingTurnMs === 0) {
      current.direction = rotateDirection(
        current.direction,
        signedUnit(random()) * effectCardConfig.tornado.maximumTurnRadians,
      )
      current.remainingTurnMs = selectTornadoTurnInterval(random)
    }
    const stepMs = Math.min(remainingMs, current.remainingTurnMs)
    const moved = advanceTornadoStraightMotion(current, stepMs, field)
    current = {
      ...moved,
      remainingTurnMs: current.remainingTurnMs - stepMs,
    }
    remainingMs -= stepMs
  }
  return current
}

export function selectTornadoTurnInterval(random: RandomSource): number {
  const config = effectCardConfig.tornado
  return (
    config.minimumTurnIntervalMs +
    clampUnit(random()) *
      (config.maximumTurnIntervalMs - config.minimumTurnIntervalMs)
  )
}

function getTornadoAnchorBounds(field: FieldSize): {
  minimumX: number
  maximumX: number
  minimumY: number
  maximumY: number
} {
  const displaySize = calculateTornadoDisplaySize()
  if (field.width < displaySize.width || field.height < displaySize.height) {
    throw new Error(
      `Cannot fit tornado display ${displaySize.width}x${displaySize.height} inside field ${field.width}x${field.height}`,
    )
  }
  return {
    minimumX: displaySize.width / 2,
    maximumX: field.width - displaySize.width / 2,
    minimumY: displaySize.height,
    maximumY: field.height,
  }
}

function advanceReflectedAxis(
  position: number,
  delta: number,
  directionComponent: number,
  minimum: number,
  maximum: number,
): { position: number; directionComponent: number } {
  if (minimum === maximum) {
    return { position: minimum, directionComponent: 0 }
  }
  let nextPosition = clamp(position, minimum, maximum) + delta
  let nextDirection = directionComponent
  while (nextPosition < minimum || nextPosition > maximum) {
    if (nextPosition < minimum) {
      nextPosition = minimum + (minimum - nextPosition)
      nextDirection = Math.abs(nextDirection)
    } else {
      nextPosition = maximum - (nextPosition - maximum)
      nextDirection = -Math.abs(nextDirection)
    }
  }
  return { position: nextPosition, directionComponent: nextDirection }
}

function rotateDirection(direction: Vector2, angle: number): Vector2 {
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  return normalizeDirection({
    x: direction.x * cosine - direction.y * sine,
    y: direction.x * sine + direction.y * cosine,
  })
}

function normalizeDirection(direction: Vector2): Vector2 {
  const length = Math.hypot(direction.x, direction.y)
  if (length === 0 || !Number.isFinite(length)) return { x: 1, y: 0 }
  return { x: direction.x / length, y: direction.y / length }
}

function signedUnit(value: number): number {
  return clampUnit(value) * 2 - 1
}

function clampUnit(value: number): number {
  return clamp(value, 0, 1)
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
