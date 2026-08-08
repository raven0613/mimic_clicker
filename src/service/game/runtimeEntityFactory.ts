import { Container, Rectangle, Sprite } from 'pixi.js'

import { mimicConfigs } from '../../configs/mimicConfigs'
import { roundConfig } from '../../configs/roundConfig'
import { spawnConfig } from '../../configs/spawnConfig'
import type { MimicId } from '../../types/game'
import { createMimicCrackVisual } from './damage/mimicCrackVisual'
import type { LoadedMimicTextures, RuntimeMimicEntity } from './runtimeTypes'

interface CreateRuntimeMimicInput {
  mimicId: MimicId
  role: RuntimeMimicEntity['role']
  decorative: boolean
  centerX: number
  centerY: number
  fieldHeight: number
  textures: LoadedMimicTextures
  onAttack: (entity: RuntimeMimicEntity) => void
}

export function createRuntimeMimicEntity(
  input: CreateRuntimeMimicInput,
): RuntimeMimicEntity {
  const cardWidth = spawnConfig.cardWidthPixels
  const cardHeight = spawnConfig.cardHeightPixels
  const texture = input.textures[input.mimicId]
  const container = new Container({ sortableChildren: true })
  const sprite = new Sprite({ texture, anchor: 0.5 })
  const flashSprite = new Sprite({ texture, anchor: 0.5, blendMode: 'add' })
  const crackVisual = input.decorative
    ? null
    : createMimicCrackVisual(input.centerX)
  sprite.setSize(cardWidth, cardHeight)
  flashSprite.setSize(cardWidth, cardHeight)
  flashSprite.alpha = 0
  flashSprite.eventMode = 'none'
  container.addChild(sprite)
  if (crackVisual) container.addChild(crackVisual.graphics)
  container.addChild(flashSprite)
  container.position.set(input.centerX, input.centerY)
  container.zIndex = input.role === 'jackpotDisguise' ? 5 : 1
  container.hitArea = new Rectangle(
    -cardWidth / 2,
    -cardHeight / 2,
    cardWidth,
    cardHeight,
  )

  const maximumHealth = input.decorative
    ? null
    : mimicConfigs[input.mimicId].maximumHealth
  const entity: RuntimeMimicEntity = {
    mimicId: input.mimicId,
    role: input.role,
    container,
    sprite,
    flashSprite,
    health: maximumHealth,
    maximumHealth,
    crackVisual,
    logicalX: input.centerX,
    logicalY: input.centerY,
    downwardSpeedPixelsPerSecond:
      (input.fieldHeight + cardHeight * 2) /
      (roundConfig.mimicFieldTravelDurationMs / 1_000),
    hitAnimationRemainingMs: 0,
    jackpotLifecycle: null,
    jackpotVelocity: { x: 0, y: 0 },
  }

  if (input.decorative) {
    container.eventMode = 'none'
  } else {
    container.eventMode = 'static'
    container.cursor = 'pointer'
    container.on('pointertap', () => input.onAttack(entity))
  }
  return entity
}
