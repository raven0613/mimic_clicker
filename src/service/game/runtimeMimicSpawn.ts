import { attachedCardConfig } from '../../configs/attachedCardConfig'
import { spawnConfig } from '../../configs/spawnConfig'
import type { MimicId, RandomSource, Vector2 } from '../../types/game'
import {
  createFieldFillSpawnArea,
  selectSpawnPosition,
  selectSpawnPositionsUntilFull,
  selectWeightedMimicId,
  type SpawnPosition,
} from '../spawn/spawn'
import {
  selectAttachedCardAssignments,
  selectHiddenEquipmentId,
} from './attachedCards/attachedCardRules'
import type { LoadedAttachedCardTextures } from './assets/runtimeAssets'
import { createRuntimeMimicEntity } from './runtimeEntityFactory'
import type { LoadedMimicTextures, RuntimeMimicEntity } from './runtimeTypes'

type RuntimeHoverChangedCallback = (
  entity: RuntimeMimicEntity,
  pointerPosition: Vector2 | null,
) => void

interface CreatePositionedRuntimeMimicInput {
  runtimeId: number
  mimicId: MimicId
  role: RuntimeMimicEntity['role']
  decorative: boolean
  fieldSize: Vector2
  position: SpawnPosition
  mimicTextures: LoadedMimicTextures
  attachedCardTextures: LoadedAttachedCardTextures
  random: RandomSource
  playRefillEntrance: boolean
  onAttack: (entity: RuntimeMimicEntity, position: Vector2) => void
  onHoverChanged: RuntimeHoverChangedCallback
}

interface RuntimeSpawnContext {
  nextRuntimeId: number
  fieldSize: Vector2
  entities: readonly RuntimeMimicEntity[]
  mimicTextures: LoadedMimicTextures
  attachedCardTextures: LoadedAttachedCardTextures
  random: RandomSource
  onAttack: (entity: RuntimeMimicEntity, position: Vector2) => void
  onHoverChanged: RuntimeHoverChangedCallback
}

interface CreateTopEdgeRuntimeMimicInput extends RuntimeSpawnContext {
  mimicId: MimicId
  role: RuntimeMimicEntity['role']
  decorative: boolean
}

interface CreateFieldFillRuntimeMimicsInput extends RuntimeSpawnContext {
  mimicPool: MimicId[]
  playRefillEntrance: boolean
  maximumNewEntityCount: number
}

type FieldFillPresentation = 'immediate' | 'clearRefill'

interface RuntimeMimicSpawnerInput {
  getFieldSize: () => Vector2
  getEntities: () => readonly RuntimeMimicEntity[]
  mimicTextures: LoadedMimicTextures
  attachedCardTextures: LoadedAttachedCardTextures
  random: RandomSource
  onAttack: (entity: RuntimeMimicEntity, position: Vector2) => void
  onHoverChanged: RuntimeHoverChangedCallback
  onSpawn: (entity: RuntimeMimicEntity) => void
}

export class RuntimeMimicSpawner {
  private readonly input: RuntimeMimicSpawnerInput
  private nextRuntimeId = 1

  public constructor(input: RuntimeMimicSpawnerInput) {
    this.input = input
  }

  public spawnTopEdge(
    mimicId: MimicId,
    role: RuntimeMimicEntity['role'],
    decorative: boolean,
  ): boolean {
    const entity = createTopEdgeRuntimeMimic({
      ...this.createContext(),
      mimicId,
      role,
      decorative,
    })
    if (!entity) return false

    this.addEntity(entity)
    return true
  }

  public fillField(
    mimicPool: MimicId[],
    presentation: FieldFillPresentation,
    maximumNewEntityCount: number = spawnConfig.maximumConcurrentMimics,
  ): number {
    const entities = createFieldFillRuntimeMimics({
      ...this.createContext(),
      mimicPool,
      playRefillEntrance: presentation === 'clearRefill',
      maximumNewEntityCount,
    })
    for (const entity of entities) this.addEntity(entity)
    return entities.length
  }

  private createContext(): RuntimeSpawnContext {
    return {
      nextRuntimeId: this.nextRuntimeId,
      fieldSize: this.input.getFieldSize(),
      entities: this.input.getEntities(),
      mimicTextures: this.input.mimicTextures,
      attachedCardTextures: this.input.attachedCardTextures,
      random: this.input.random,
      onAttack: this.input.onAttack,
      onHoverChanged: this.input.onHoverChanged,
    }
  }

  private addEntity(entity: RuntimeMimicEntity): void {
    this.nextRuntimeId += 1
    this.input.onSpawn(entity)
  }
}

function createTopEdgeRuntimeMimic(
  input: CreateTopEdgeRuntimeMimicInput,
): RuntimeMimicEntity | null {
  const spawnY =
    -spawnConfig.cardHeightPixels + spawnConfig.spawnYInsetPixels
  const position = selectSpawnPosition(
    {
      fieldWidth: input.fieldSize.x,
      cardWidth: spawnConfig.cardWidthPixels,
      cardHeight: spawnConfig.cardHeightPixels,
      minimumY: spawnY,
      maximumY: spawnY,
      occupiedBounds: createOccupiedBounds(input.entities),
    },
    input.random,
  )
  if (!position) return null

  return createPositionedRuntimeMimic({
    ...input,
    runtimeId: input.nextRuntimeId,
    playRefillEntrance: false,
    position,
  })
}

function createFieldFillRuntimeMimics(
  input: CreateFieldFillRuntimeMimicsInput,
): RuntimeMimicEntity[] {
  const positions = selectSpawnPositionsUntilFull(
    {
      fieldWidth: input.fieldSize.x,
      cardWidth: spawnConfig.cardWidthPixels,
      cardHeight: spawnConfig.cardHeightPixels,
      ...createFieldFillSpawnArea(input.fieldSize.y),
      occupiedBounds: createOccupiedBounds(input.entities),
      maximumPositionCount:
        Math.min(
          input.maximumNewEntityCount,
          spawnConfig.maximumConcurrentMimics - input.entities.length,
        ),
    },
    input.random,
  )

  return positions.map((position, index) =>
    createPositionedRuntimeMimic({
      ...input,
      runtimeId: input.nextRuntimeId + index,
      mimicId: selectWeightedMimicId(input.mimicPool, input.random),
      role: 'regular',
      decorative: false,
      position,
    }),
  )
}

function createPositionedRuntimeMimic(
  input: CreatePositionedRuntimeMimicInput,
): RuntimeMimicEntity {
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
    centerX: input.position.x + spawnConfig.cardWidthPixels / 2,
    centerY: input.position.y + spawnConfig.cardHeightPixels / 2,
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
    playRefillEntrance: input.playRefillEntrance,
    onAttack: input.onAttack,
    onHoverChanged: input.onHoverChanged,
  })
}

function createOccupiedBounds(
  entities: readonly RuntimeMimicEntity[],
): Array<{ x: number; y: number; width: number; height: number }> {
  return entities.map((entity) => ({
    x: entity.logicalX - spawnConfig.cardWidthPixels / 2,
    y: entity.logicalY - spawnConfig.cardHeightPixels / 2,
    width: spawnConfig.cardWidthPixels,
    height: spawnConfig.cardHeightPixels,
  }))
}
