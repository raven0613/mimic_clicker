import { balanceSimulationConfig } from '../../configs/balanceSimulationConfig'
import { mimicConfigs } from '../../configs/mimicConfigs'
import { roundConfig } from '../../configs/roundConfig'
import { spawnConfig } from '../../configs/spawnConfig'
import type { MimicId, RectangleBounds } from '../../types/game'
import {
  createFieldFillSpawnArea,
  selectSpawnPosition,
  selectSpawnPositionsUntilFull,
  selectWeightedMimicId,
  type SpawnPosition,
} from '../spawn/spawn'
import { selectSimulatedAttachedContent } from './attachedCardSimulation'
import { createSeededRandom } from './createSeededRandom'
import type { BalanceCombatMimic } from './effectCardBalanceSimulation'

export interface SpawnStreamMetrics {
  generatedByMimic: Record<MimicId, number>
  initialFieldMimicCount: number
  placementAttempts: number
  placementRejections: number
  spawnedMimics: BalanceCombatMimic[]
}

interface ActiveBounds extends RectangleBounds {
  updatedAtMs: number
}

export function simulateSpawnStream(
  pool: MimicId[],
  seed: number,
): SpawnStreamMetrics {
  const random = createSeededRandom(seed)
  const generatedByMimic = emptyMimicCounts()
  const activeBounds: ActiveBounds[] = []
  const spawnedMimics: BalanceCombatMimic[] = []
  const movementSpeed = calculateMovementSpeed()
  const initialPositions = selectSpawnPositionsUntilFull(
    {
      fieldWidth: balanceSimulationConfig.field.widthPixels,
      cardWidth: spawnConfig.cardWidthPixels,
      cardHeight: spawnConfig.cardHeightPixels,
      ...createFieldFillSpawnArea(
        balanceSimulationConfig.field.heightPixels,
      ),
      occupiedBounds: [],
      maximumPositionCount: spawnConfig.maximumConcurrentMimics,
    },
    random,
  )
  let placementAttempts =
    initialPositions.length +
    Number(initialPositions.length < spawnConfig.maximumConcurrentMimics)
  let placementRejections = Number(
    initialPositions.length < spawnConfig.maximumConcurrentMimics,
  )

  const addMimic = (
    mimicId: MimicId,
    position: SpawnPosition,
    spawnedAtMs: number,
  ) => {
    generatedByMimic[mimicId] += 1
    spawnedMimics.push({
      id: spawnedMimics.length,
      mimicId,
      role: 'regular',
      health: mimicConfigs[mimicId].maximumHealth,
      logicalX: position.x + spawnConfig.cardWidthPixels / 2,
      logicalY: position.y + spawnConfig.cardHeightPixels / 2,
      jackpotPhase: null,
      spawnedAtMs,
      initialY: position.y + spawnConfig.cardHeightPixels / 2,
      ...selectSimulatedAttachedContent(mimicId, random),
    })
    activeBounds.push({
      ...position,
      width: spawnConfig.cardWidthPixels,
      height: spawnConfig.cardHeightPixels,
      updatedAtMs: spawnedAtMs,
    })
  }

  for (const position of initialPositions) {
    addMimic(selectWeightedMimicId(pool, random), position, 0)
  }

  let nextSpawnMs = roundConfig.initialSpawnDelayMs
  while (nextSpawnMs < roundConfig.durationMs) {
    advanceActiveBounds(activeBounds, nextSpawnMs, movementSpeed)
    removeExitedBounds(activeBounds)

    if (activeBounds.length >= spawnConfig.maximumConcurrentMimics) {
      nextSpawnMs += calculateWaitUntilCapacity(activeBounds, movementSpeed)
      continue
    }

    placementAttempts += 1
    const mimicId = selectWeightedMimicId(pool, random)
    const spawnY =
      -spawnConfig.cardHeightPixels + spawnConfig.spawnYInsetPixels
    const position = selectSpawnPosition(
      {
        fieldWidth: balanceSimulationConfig.field.widthPixels,
        cardWidth: spawnConfig.cardWidthPixels,
        cardHeight: spawnConfig.cardHeightPixels,
        minimumY: spawnY,
        maximumY: spawnY,
        occupiedBounds: activeBounds,
      },
      random,
    )
    if (!position) {
      placementRejections += 1
      nextSpawnMs += spawnConfig.retryDelayMs
      continue
    }

    addMimic(mimicId, position, nextSpawnMs)
    nextSpawnMs += roundConfig.regularSpawnIntervalMs
  }

  return {
    generatedByMimic,
    initialFieldMimicCount: initialPositions.length,
    placementAttempts,
    placementRejections,
    spawnedMimics,
  }
}

export function calculateMimicFlowExitDurationMs(initialTopY: number): number {
  return (
    ((balanceSimulationConfig.field.heightPixels - initialTopY) /
      calculateMovementSpeed()) *
    1_000
  )
}

function calculateMovementSpeed(): number {
  return (
    (balanceSimulationConfig.field.heightPixels +
      spawnConfig.cardHeightPixels * 2) /
    (roundConfig.mimicFieldTravelDurationMs / 1_000)
  )
}

function advanceActiveBounds(
  activeBounds: ActiveBounds[],
  atMs: number,
  movementSpeed: number,
): void {
  for (const bounds of activeBounds) {
    bounds.y += movementSpeed * ((atMs - bounds.updatedAtMs) / 1_000)
    bounds.updatedAtMs = atMs
  }
}

function removeExitedBounds(activeBounds: ActiveBounds[]): void {
  for (let index = activeBounds.length - 1; index >= 0; index -= 1) {
    if (activeBounds[index].y > balanceSimulationConfig.field.heightPixels) {
      activeBounds.splice(index, 1)
    }
  }
}

function calculateWaitUntilCapacity(
  activeBounds: readonly ActiveBounds[],
  movementSpeed: number,
): number {
  const earliestExitMs = Math.min(
    ...activeBounds.map(
      (bounds) =>
        ((balanceSimulationConfig.field.heightPixels - bounds.y) /
          movementSpeed) *
        1_000,
    ),
  )
  return Math.max(1, earliestExitMs)
}

function emptyMimicCounts(): Record<MimicId, number> {
  return { normal: 0, rare1: 0, rare2: 0 }
}
