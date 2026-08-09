import type { RandomSource } from '../../../types/game'
import type { LoadedAttachedCardTextures } from '../assets/runtimeAssets'
import { setRuntimeAttachedCards } from '../runtimeEntityFactory'
import type { RuntimeMimicEntity } from '../runtimeTypes'
import {
  selectHiddenEquipmentId,
  selectJackpotAttachedCardAssignments,
} from './attachedCardRules'
import {
  updateAttachedCardHalo,
  type EffectCardAttachment,
  type EquipmentCardAttachment,
  type RuntimeAttachedCardFan,
} from './attachedCardVisual'

export interface ReleasedRuntimeAttachedCards {
  fan: RuntimeAttachedCardFan | null
  effectCards: EffectCardAttachment[]
  equipmentCards: EquipmentCardAttachment[]
  hiddenEquipmentId: RuntimeMimicEntity['hiddenEquipmentId']
}

export function updateRuntimeAttachedCardHalos(
  entity: RuntimeMimicEntity,
  elapsedMs: number,
): void {
  if (entity.container.destroyed) return
  for (const card of entity.attachedCards) {
    updateAttachedCardHalo(card, elapsedMs)
  }
}

export function releaseRuntimeAttachedCards(
  entity: RuntimeMimicEntity,
): ReleasedRuntimeAttachedCards {
  const fan = entity.attachedCardFan
  const cards = entity.attachedCards
  const hiddenEquipmentId = entity.hiddenEquipmentId
  entity.attachedCardFan = null
  entity.attachedCards = []
  entity.hiddenEquipmentId = null
  return {
    fan,
    effectCards: cards.filter(
      (card): card is EffectCardAttachment => card.kind === 'effect',
    ),
    equipmentCards: cards.filter(
      (card): card is EquipmentCardAttachment => card.kind === 'equipment',
    ),
    hiddenEquipmentId,
  }
}

export function assignJackpotRuntimeAttachedCards(
  entity: RuntimeMimicEntity,
  textures: LoadedAttachedCardTextures,
  random: RandomSource,
): void {
  const assignments = selectJackpotAttachedCardAssignments(random)
  setRuntimeAttachedCards(entity, assignments, textures)
  entity.hiddenEquipmentId = selectHiddenEquipmentId(
    false,
    assignments
      .filter((assignment) => assignment.kind === 'equipment')
      .map((assignment) => assignment.id),
    random,
  )
}
