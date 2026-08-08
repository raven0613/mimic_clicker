import { animationConfig } from '../../../configs/animationConfig'
import { applyDamage } from '../../combat/combat'
import type { RuntimeMimicEntity } from '../runtimeTypes'
import { selectMimicCrackStage } from './mimicCrackStage'
import { updateMimicCrackVisual } from './mimicCrackVisual'

export function applyRuntimeMimicDamage(
  entity: RuntimeMimicEntity,
  damage: number,
): boolean {
  if (entity.health === null || entity.maximumHealth === null) {
    throw new Error(`Cannot damage non-combat Mimic ${entity.mimicId}`)
  }

  const result = applyDamage(entity.health, damage)
  entity.health = result.remainingHealth
  entity.hitAnimationRemainingMs = animationConfig.hit.durationMs
  updateMimicCrackVisual(
    entity.crackVisual,
    selectMimicCrackStage(entity.health, entity.maximumHealth),
  )
  return result.isDefeated
}

export function resetRuntimeMimicHealth(
  entity: RuntimeMimicEntity,
  maximumHealth: number,
): void {
  entity.health = maximumHealth
  entity.maximumHealth = maximumHealth
  updateMimicCrackVisual(entity.crackVisual, 'intact')
}
