import { attachedCardConfig } from '../../../configs/attachedCardConfig'
import type { RandomSource } from '../../../types/game'
import type { LoadedEffectCardTextures } from '../assets/runtimeAssets'
import { setRuntimeEffectCards } from '../runtimeEntityFactory'
import type { RuntimeMimicEntity } from '../runtimeTypes'
import type { EffectCardSystem } from './EffectCardSystem'
import { selectEffectCardAssignments } from './effectCardRules'
import { updateEffectCardHalo } from './effectCardVisual'

export function updateRuntimeEffectCardHalos(
  entity: RuntimeMimicEntity,
  elapsedMs: number,
): void {
  if (entity.container.destroyed) return
  for (const effectCard of entity.effectCards) {
    updateEffectCardHalo(effectCard, elapsedMs)
  }
}

export function activateRuntimeEffectCards(
  entity: RuntimeMimicEntity,
  system: EffectCardSystem | null,
): void {
  if (entity.effectCards.length === 0 || !system) return
  const fan = entity.attachedCardFan
  const attachments = entity.effectCards
  entity.attachedCardFan = null
  entity.effectCards = []
  system.activateAll(attachments, entity.logicalX, entity.logicalY)
  fan?.container.removeFromParent()
  fan?.container.destroy({ children: true })
}

export function assignJackpotRuntimeEffectCards(
  entity: RuntimeMimicEntity,
  textures: LoadedEffectCardTextures,
  random: RandomSource,
): void {
  setRuntimeEffectCards(
    entity,
    selectEffectCardAssignments(
      false,
      attachedCardConfig.capacity.jackpot.maximum,
      random,
    ),
    textures,
  )
}
