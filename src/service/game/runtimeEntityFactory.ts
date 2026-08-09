import { Container, Rectangle, Sprite, type FederatedPointerEvent } from 'pixi.js'

import { attachedCardFanContainsPoint } from './attachedCards/attachedCardLayout'
import { mimicConfigs } from '../../configs/mimicConfigs'
import { roundConfig } from '../../configs/roundConfig'
import { spawnConfig } from '../../configs/spawnConfig'
import type { MimicId, Vector2 } from '../../types/game'
import type { LoadedAttachedCardTextures } from './assets/runtimeAssets'
import { createMimicCrackVisual } from './damage/mimicCrackVisual'
import type { EquipmentId } from '../../configs/equipmentConfig'
import type { AttachedCardAssignment } from './attachedCards/attachedCardRules'
import { createAttachedCardFanVisual } from './attachedCards/attachedCardVisual'
import { initializeRefillEntranceAnimation } from './clearRefill/refillEntranceAnimation'
import type { LoadedMimicTextures, RuntimeMimicEntity } from './runtimeTypes'

interface CreateRuntimeMimicInput {
  runtimeId: number
  mimicId: MimicId
  role: RuntimeMimicEntity['role']
  decorative: boolean
  centerX: number
  centerY: number
  fieldHeight: number
  textures: LoadedMimicTextures
  attachedCardTextures: LoadedAttachedCardTextures
  attachedCardAssignments: readonly AttachedCardAssignment[]
  hiddenEquipmentId: EquipmentId | null
  playRefillEntrance: boolean
  onAttack: (entity: RuntimeMimicEntity, position: Vector2) => void
}

export function createRuntimeMimicEntity(
  input: CreateRuntimeMimicInput,
): RuntimeMimicEntity {
  const cardWidth = spawnConfig.cardWidthPixels
  const cardHeight = spawnConfig.cardHeightPixels
  const texture = input.textures[input.mimicId]
  const container = new Container()
  const visualContainer = new Container()
  const sprite = new Sprite({ texture, anchor: 0.5 })
  const flashSprite = new Sprite({ texture, anchor: 0.5, blendMode: 'add' })
  const crackVisual = input.decorative
    ? null
    : createMimicCrackVisual(input.centerX)
  sprite.setSize(cardWidth, cardHeight)
  flashSprite.setSize(cardWidth, cardHeight)
  flashSprite.alpha = 0
  flashSprite.eventMode = 'none'
  visualContainer.addChild(sprite)
  if (crackVisual) visualContainer.addChild(crackVisual.graphics)
  visualContainer.addChild(flashSprite)
  container.addChild(visualContainer)
  container.position.set(input.centerX, input.centerY)
  container.zIndex = input.role === 'jackpotDisguise' ? 5 : 1
  const mimicHitArea = new Rectangle(
    -cardWidth / 2,
    -cardHeight / 2,
    cardWidth,
    cardHeight,
  )
  container.hitArea = mimicHitArea

  const maximumHealth = input.decorative
    ? null
    : mimicConfigs[input.mimicId].maximumHealth
  const entity: RuntimeMimicEntity = {
    runtimeId: input.runtimeId,
    mimicId: input.mimicId,
    role: input.role,
    container,
    visualContainer,
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
    refillEntranceElapsedMs: null,
    nextWeaponDamageAllowedAtMs: 0,
    jackpotLifecycle: null,
    jackpotVelocity: { x: 0, y: 0 },
    attachedCardFan: null,
    attachedCards: [],
    hiddenEquipmentId: input.hiddenEquipmentId,
  }
  initializeRefillEntranceAnimation(entity, input.playRefillEntrance)
  setRuntimeAttachedCards(
    entity,
    input.attachedCardAssignments,
    input.attachedCardTextures,
  )
  container.hitArea = {
    contains: (x, y) =>
      mimicHitArea.contains(x, y) ||
      (entity.attachedCardFan !== null &&
        attachedCardFanContainsPoint(x, y, entity.attachedCardFan.layout)),
  }

  if (input.decorative) {
    container.eventMode = 'none'
  } else {
    container.eventMode = 'static'
    container.cursor = 'pointer'
    container.on('pointertap', (event: FederatedPointerEvent) =>
      input.onAttack(entity, { x: event.global.x, y: event.global.y }),
    )
  }
  return entity
}

export function setRuntimeAttachedCards(
  entity: RuntimeMimicEntity,
  assignments: readonly AttachedCardAssignment[],
  textures: LoadedAttachedCardTextures,
): void {
  if (entity.attachedCardFan) {
    entity.attachedCardFan.container.removeFromParent()
    entity.attachedCardFan.container.destroy({ children: true })
  }
  const fan = createAttachedCardFanVisual(assignments, textures)
  entity.attachedCardFan = fan
  entity.attachedCards = fan ? [...fan.cards] : []
  if (fan) entity.visualContainer.addChild(fan.container)
}
