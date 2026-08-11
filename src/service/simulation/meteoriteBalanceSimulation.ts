import { effectCardConfig } from '../../configs/effectCardConfig'
import { roundConfig } from '../../configs/roundConfig'
import type { RandomSource, Vector2 } from '../../types/game'
import {
  createMeteoriteLaunchOffsets,
  createMeteoriteTrajectory,
  selectFirstMeteoriteLandingPoint,
  selectMeteoriteLandingPoint,
  selectSpacedMeteoriteLandingPoint,
} from '../game/effectCards/meteoriteRules'
import type { EffectAttackTarget } from '../game/effectCards/effectTargeting'
import type {
  PendingCardEvent,
  SimulatedCombatMimic,
  SimulatedMeteoriteImpact,
} from './effectCardBalanceTypes'

interface FieldSize {
  width: number
  height: number
}

interface CreateSimulatedMeteoriteImpactsInput {
  event: PendingCardEvent
  field: FieldSize
  getActiveMimics: (atMs: number) => SimulatedCombatMimic[]
  random: RandomSource
}

export function createSimulatedMeteoriteImpacts(
  input: CreateSimulatedMeteoriteImpactsInput,
): SimulatedMeteoriteImpact[] {
  const { event, field, getActiveMimics, random } = input
  const offsets =
    event.meteoriteLaunchOffsetsMs ??
    createMeteoriteLaunchOffsets(
      effectCardConfig.meteorite.initialMeteoriteCount,
      random,
    )
  const firstTargetLanding =
    event.meteoriteLandings?.[0] ??
    selectFirstMeteoriteLandingPoint(
      field,
      getActiveMimics(event.readyAtMs),
      random,
    )
  const firstTargetWaitMs = firstTargetLanding
    ? 0
    : effectCardConfig.meteorite.maximumFirstTargetWaitMs
  const previousLandings: Vector2[] = []
  const impacts: SimulatedMeteoriteImpact[] = []

  for (let index = 0; index < offsets.length; index += 1) {
    const launchAtMs = event.readyAtMs + firstTargetWaitMs + offsets[index]
    if (launchAtMs >= roundConfig.durationMs) continue
    const landing =
      event.meteoriteLandings?.[index] ??
      (index === 0 && firstTargetLanding
        ? firstTargetLanding
        : selectLanding(
            field,
            previousLandings,
            getActiveMimics,
            launchAtMs,
            random,
          ))
    previousLandings.push(landing)
    const trajectory = createMeteoriteTrajectory(field, landing)
    impacts.push({
      kind: 'meteoriteImpact',
      impactAtMs:
        launchAtMs +
        trajectory.distance /
          effectCardConfig.meteorite.flightSpeedPixelsPerSecond *
          1_000,
      landing,
      chainDepth: event.chainDepth,
      chainId: event.chainId,
    })
  }
  return impacts
}

export function createSimulatedMeteoriteLandingSequence<
  T extends EffectAttackTarget,
>(
  field: FieldSize,
  targets: readonly T[],
  count: number,
  random: RandomSource,
): Vector2[] {
  const landings: Vector2[] = []
  for (let index = 0; index < count; index += 1) {
    const landing =
      index === 0
        ? selectFirstMeteoriteLandingPoint(field, targets, random)
        : selectSpacedMeteoriteLandingPoint(field, landings, random)
    if (landing) landings.push(landing)
  }
  return landings
}

function selectLanding(
  field: FieldSize,
  previousLandings: readonly Vector2[],
  getActiveMimics: (atMs: number) => SimulatedCombatMimic[],
  launchAtMs: number,
  random: RandomSource,
): Vector2 {
  if (previousLandings.length > 0) {
    return selectSpacedMeteoriteLandingPoint(
      field,
      previousLandings,
      random,
    )
  }
  return (
    selectFirstMeteoriteLandingPoint(
      field,
      getActiveMimics(launchAtMs),
      random,
    ) ?? selectMeteoriteLandingPoint(field, random)
  )
}
