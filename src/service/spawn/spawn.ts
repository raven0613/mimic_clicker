import { mimicConfigs } from '../../configs/mimicConfigs'
import { spawnConfig } from '../../configs/spawnConfig'
import type {
  MimicId,
  RandomSource,
  RectangleBounds,
} from '../../types/game'

export interface SpawnPositionInput {
  fieldWidth: number
  cardWidth: number
  cardHeight: number
  minimumY: number
  maximumY: number
  occupiedBounds: RectangleBounds[]
}

interface FillSpawnAreaInput extends SpawnPositionInput {
  maximumPositionCount: number
}

export interface SpawnPosition {
  x: number
  y: number
}

export function selectWeightedMimicId(
  mimicPool: MimicId[],
  random: RandomSource,
): MimicId {
  if (mimicPool.length === 0) {
    throw new Error('Cannot select a mimic from an empty spawn pool')
  }

  const totalWeight = mimicPool.reduce(
    (sum, mimicId) => sum + mimicConfigs[mimicId].spawnWeight,
    0,
  )
  let remaining = random() * totalWeight

  for (const mimicId of mimicPool) {
    remaining -= mimicConfigs[mimicId].spawnWeight
    if (remaining < 0) {
      return mimicId
    }
  }

  return mimicPool[mimicPool.length - 1]
}

export function calculateOverlapRatio(
  first: RectangleBounds,
  second: RectangleBounds,
): number {
  const overlapWidth = Math.max(
    0,
    Math.min(first.x + first.width, second.x + second.width) -
      Math.max(first.x, second.x),
  )
  const overlapHeight = Math.max(
    0,
    Math.min(first.y + first.height, second.y + second.height) -
      Math.max(first.y, second.y),
  )

  return (overlapWidth * overlapHeight) / (first.width * first.height)
}

export function selectSpawnPosition(
  input: SpawnPositionInput,
  random: RandomSource,
): SpawnPosition | null {
  const minimumX = spawnConfig.horizontalSafeMarginPixels
  const maximumX =
    input.fieldWidth -
    spawnConfig.horizontalSafeMarginPixels -
    input.cardWidth
  if (maximumX < minimumX || input.maximumY < input.minimumY) {
    return null
  }

  let bestCandidate: SpawnPosition | null = null
  let bestOverlap = Number.POSITIVE_INFINITY

  for (let index = 0; index < spawnConfig.candidatePositionCount; index += 1) {
    const candidate = {
      x: minimumX + random() * (maximumX - minimumX),
      y:
        input.minimumY === input.maximumY
          ? input.minimumY
          : input.minimumY + random() * (input.maximumY - input.minimumY),
    }
    const candidateBounds = {
      ...candidate,
      width: input.cardWidth,
      height: input.cardHeight,
    }
    const maximumOverlap = input.occupiedBounds.reduce(
      (overlap, occupied) =>
        Math.max(overlap, calculateOverlapRatio(candidateBounds, occupied)),
      0,
    )

    if (
      maximumOverlap <= spawnConfig.maximumOverlapRatio &&
      maximumOverlap < bestOverlap
    ) {
      bestCandidate = candidate
      bestOverlap = maximumOverlap
    }
  }

  return bestCandidate
}

export function createInitialFieldSpawnArea(fieldHeight: number): {
  minimumY: number
  maximumY: number
} {
  return {
    minimumY: 0,
    maximumY:
      fieldHeight -
      spawnConfig.initialFieldBottomNoSpawnHeightPixels -
      spawnConfig.cardHeightPixels,
  }
}

export function selectSpawnPositionsUntilFull(
  input: FillSpawnAreaInput,
  random: RandomSource,
): SpawnPosition[] {
  const occupiedBounds = [...input.occupiedBounds]
  const positions: SpawnPosition[] = []

  while (positions.length < input.maximumPositionCount) {
    const position = selectSpawnPosition(
      { ...input, occupiedBounds },
      random,
    )
    if (!position) break

    positions.push(position)
    occupiedBounds.push({
      ...position,
      width: input.cardWidth,
      height: input.cardHeight,
    })
  }

  return positions
}
