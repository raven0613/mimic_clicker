import { attachedCardConfig } from '../../configs/attachedCardConfig'
import { spawnConfig } from '../../configs/spawnConfig'
import type { MimicId, RandomSource, Vector2 } from '../../types/game'
import { selectSpawnPosition } from '../spawn/spawn'
import {
  selectAttachedCardAssignments,
  selectHiddenEquipmentId,
} from './attachedCards/attachedCardRules'
import type { LoadedAttachedCardTextures } from './assets/runtimeAssets'
import { createRuntimeMimicEntity } from './runtimeEntityFactory'
import type { LoadedMimicTextures, RuntimeMimicEntity } from './runtimeTypes'

interface CreateSpawnedRuntimeMimicInput {
  runtimeId: number
  mimicId: MimicId
  role: RuntimeMimicEntity['role']
  decorative: boolean
  fieldSize: Vector2
  entities: readonly RuntimeMimicEntity[]
  mimicTextures: LoadedMimicTextures
  attachedCardTextures: LoadedAttachedCardTextures
  random: RandomSource
  onAttack: (entity: RuntimeMimicEntity, position: Vector2) => void
}

export function createSpawnedRuntimeMimic(
  input: CreateSpawnedRuntimeMimicInput,
): RuntimeMimicEntity | null {
  const cardWidth = spawnConfig.cardWidthPixels
  const cardHeight = spawnConfig.cardHeightPixels
  const spawnY = -cardHeight + spawnConfig.spawnYInsetPixels
  const occupiedBounds = input.entities
    .filter(
      (entity) =>
        Math.abs(entity.logicalY - spawnY) <=
        spawnConfig.placementCheckVerticalRangePixels,
    )
    .map((entity) => ({
      x: entity.logicalX - cardWidth / 2,
      y: entity.logicalY - cardHeight / 2,
      width: cardWidth,
      height: cardHeight,
    }))
  const position = selectSpawnPosition(
    {
      fieldWidth: input.fieldSize.x,
      cardWidth,
      cardHeight,
      spawnY,
      occupiedBounds,
    },
    input.random,
  )
  if (!position) return null

  const assignments = selectAttachedCardAssignments({
    decorative: input.decorative,
    maximumCount: attachedCardConfig.capacity.byMimic[input.mimicId],
    random: input.random,
  })
  return createRuntimeMimicEntity({
    runtimeId: input.runtimeId,
    mimicId: input.mimicId,
    role: input.role,
    decorative: input.decorative,
    centerX: position.x + cardWidth / 2,
    centerY: position.y + cardHeight / 2,
    fieldHeight: input.fieldSize.y,
    textures: input.mimicTextures,
    attachedCardTextures: input.attachedCardTextures,
    attachedCardAssignments: assignments,
    hiddenEquipmentId: selectHiddenEquipmentId(
      input.decorative,
      assignments
        .filter((assignment) => assignment.kind === 'equipment')
        .map((assignment) => assignment.id),
      input.random,
    ),
    onAttack: input.onAttack,
  })
}
