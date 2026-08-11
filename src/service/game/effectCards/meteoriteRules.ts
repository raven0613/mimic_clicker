import { effectCardConfig } from '../../../configs/effectCardConfig'
import { spawnConfig } from '../../../configs/spawnConfig'
import type { RandomSource, Vector2 } from '../../../types/game'
import { calculateSpriteDisplaySize } from '../effects/spriteDisplaySize'
import {
  isEligibleEffectAttackTarget,
  type EffectAttackTarget,
} from './effectTargeting'

interface FieldSize {
  width: number
  height: number
}

export interface MeteoriteTrajectory {
  start: Vector2
  landing: Vector2
  direction: Vector2
  distance: number
}

export interface MeteoriteFlightState {
  position: Vector2
  remainingDistance: number
}

export interface MeteoriteFlightProgress extends MeteoriteFlightState {
  arrived: boolean
}

export function calculateMeteoriteDisplaySize(
  displayScale: number = effectCardConfig.meteorite.displayScale,
): { width: number; height: number } {
  const sheet = effectCardConfig.meteorite.spriteSheet
  return calculateSpriteDisplaySize(
    sheet.frameWidthPixels,
    sheet.frameHeightPixels,
    displayScale,
  )
}

export function calculateExplosionDisplaySize(
  displayScale: number = effectCardConfig.meteorite.displayScale,
): { width: number; height: number } {
  const sheet = effectCardConfig.meteorite.explosionSpriteSheet
  return calculateSpriteDisplaySize(
    sheet.frameWidthPixels,
    sheet.frameHeightPixels,
    displayScale,
  )
}

export function calculateMeteoriteDamageAreaSide(
  displayScale: number = effectCardConfig.meteorite.displayScale,
  damageAreaWidthMultiplier: number =
    effectCardConfig.meteorite.damageAreaWidthMultiplier,
): number {
  if (
    !Number.isFinite(damageAreaWidthMultiplier) ||
    damageAreaWidthMultiplier <= 0
  ) {
    throw new Error(
      `Meteorite damage area width multiplier must be greater than zero, received ${damageAreaWidthMultiplier}`,
    )
  }
  return (
    calculateExplosionDisplaySize(displayScale).width *
    damageAreaWidthMultiplier
  )
}

export function selectMeteoriteLandingPoint(
  field: FieldSize,
  random: RandomSource,
): Vector2 {
  const side = calculateMeteoriteDamageAreaSide()
  assertMeteoriteCanFit(field, side)
  return {
    x: side / 2 + clampUnit(random()) * (field.width - side),
    y: side + clampUnit(random()) * (field.height - side),
  }
}

export function selectFirstMeteoriteLandingPoint<
  T extends EffectAttackTarget,
>(
  field: FieldSize,
  targets: readonly T[],
  random: RandomSource,
): Vector2 | null {
  const eligibleTargets = targets.filter(isEligibleEffectAttackTarget)
  if (eligibleTargets.length === 0) return null

  const selectedIndex = Math.min(
    eligibleTargets.length - 1,
    Math.floor(clampUnit(random()) * eligibleTargets.length),
  )
  const selected = eligibleTargets[selectedIndex]
  const side = calculateMeteoriteDamageAreaSide()
  assertMeteoriteCanFit(field, side)
  return {
    x: clamp(
      selected.logicalX,
      side / 2,
      field.width - side / 2,
    ),
    y: clamp(
      selected.logicalY + spawnConfig.cardHeightPixels / 2,
      side,
      field.height,
    ),
  }
}

export function selectSpacedMeteoriteLandingPoint(
  field: FieldSize,
  previousLandings: readonly Vector2[],
  random: RandomSource,
): Vector2 {
  if (previousLandings.length === 0) {
    return selectMeteoriteLandingPoint(field, random)
  }

  const config = effectCardConfig.meteorite
  if (!Number.isInteger(config.landingCandidateCount) || config.landingCandidateCount <= 0) {
    throw new Error('Meteorite landing candidate count must be a positive integer')
  }
  if (
    !Number.isFinite(config.minimumLandingDistanceMultiplier) ||
    config.minimumLandingDistanceMultiplier <= 0
  ) {
    throw new Error(
      'Meteorite minimum landing distance multiplier must be greater than zero',
    )
  }
  const candidates = Array.from(
    { length: config.landingCandidateCount },
    () => selectMeteoriteLandingPoint(field, random),
  )
  const minimumDistance =
    calculateMeteoriteDamageAreaSide() *
    config.minimumLandingDistanceMultiplier
  const qualifying = candidates.find(
    (candidate) =>
      minimumDistanceFrom(candidate, previousLandings) >= minimumDistance,
  )
  if (qualifying) return qualifying

  return candidates.reduce((farthest, candidate) =>
    minimumDistanceFrom(candidate, previousLandings) >
    minimumDistanceFrom(farthest, previousLandings)
      ? candidate
      : farthest,
  )
}

export function createMeteoriteTrajectory(
  field: FieldSize,
  landing: Vector2,
): MeteoriteTrajectory {
  const rotation = effectCardConfig.meteorite.rotationRadians
  const direction = { x: -Math.sin(rotation), y: Math.cos(rotation) }
  const reverse = { x: -direction.x, y: -direction.y }
  const relativeBounds = getRotatedMeteoriteBounds(rotation)
  const outsideMargin = effectCardConfig.meteorite.entryOutsideMarginPixels
  const distanceToRight =
    (field.width + outsideMargin - landing.x - relativeBounds.minimumX) /
    reverse.x
  const distanceToTop =
    (landing.y + relativeBounds.maximumY + outsideMargin) / -reverse.y
  const distance = Math.max(0, Math.min(distanceToRight, distanceToTop))
  return {
    start: {
      x: landing.x + reverse.x * distance,
      y: landing.y + reverse.y * distance,
    },
    landing: { ...landing },
    direction,
    distance,
  }
}

export function advanceMeteoriteFlight(
  state: MeteoriteFlightState,
  deltaMs: number,
  direction: Vector2,
): MeteoriteFlightProgress {
  const requestedDistance =
    effectCardConfig.meteorite.flightSpeedPixelsPerSecond *
    (Math.max(0, deltaMs) / 1_000)
  const traveledDistance = Math.min(state.remainingDistance, requestedDistance)
  const remainingDistance = state.remainingDistance - traveledDistance
  return {
    position: {
      x: state.position.x + direction.x * traveledDistance,
      y: state.position.y + direction.y * traveledDistance,
    },
    remainingDistance,
    arrived: remainingDistance === 0,
  }
}

export function createMeteoriteLaunchOffsets(
  count: number,
  random: RandomSource,
): number[] {
  if (count <= 0) return []
  const offsets = [0]
  let elapsedMs = 0
  for (let index = 1; index < count; index += 1) {
    const config = effectCardConfig.meteorite
    elapsedMs +=
      config.minimumLaunchIntervalMs +
      clampUnit(random()) *
        (config.maximumLaunchIntervalMs - config.minimumLaunchIntervalMs)
    offsets.push(elapsedMs)
  }
  return offsets
}

export function collectMeteoriteHitTargets<T extends EffectAttackTarget>(
  targets: readonly T[],
  landing: Vector2,
): T[] {
  const side = calculateMeteoriteDamageAreaSide()
  const halfWidth = side / 2
  const mimicHalfWidth = spawnConfig.cardWidthPixels / 2
  const mimicHalfHeight = spawnConfig.cardHeightPixels / 2
  return targets.filter(
    (target) =>
      isEligibleEffectAttackTarget(target) &&
      target.logicalX + mimicHalfWidth >= landing.x - halfWidth &&
      target.logicalX - mimicHalfWidth <= landing.x + halfWidth &&
      target.logicalY + mimicHalfHeight >= landing.y - side &&
      target.logicalY - mimicHalfHeight <= landing.y,
  )
}

function getRotatedMeteoriteBounds(rotation: number): {
  minimumX: number
  maximumY: number
} {
  const displaySize = calculateMeteoriteDisplaySize()
  const corners = [
    { x: -displaySize.width / 2, y: -displaySize.height },
    { x: displaySize.width / 2, y: -displaySize.height },
    { x: -displaySize.width / 2, y: 0 },
    { x: displaySize.width / 2, y: 0 },
  ].map(({ x, y }) => ({
    x: x * Math.cos(rotation) - y * Math.sin(rotation),
    y: x * Math.sin(rotation) + y * Math.cos(rotation),
  }))
  return {
    minimumX: Math.min(...corners.map(({ x }) => x)),
    maximumY: Math.max(...corners.map(({ y }) => y)),
  }
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function minimumDistanceFrom(
  point: Vector2,
  previousPoints: readonly Vector2[],
): number {
  return Math.min(
    ...previousPoints.map((previous) =>
      Math.hypot(point.x - previous.x, point.y - previous.y),
    ),
  )
}

function assertMeteoriteCanFit(field: FieldSize, side: number): void {
  if (field.width < side || field.height < side) {
    throw new Error(
      `Cannot place meteorite damage area ${side}x${side} inside field ${field.width}x${field.height}`,
    )
  }
}
