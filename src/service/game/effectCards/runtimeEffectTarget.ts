import type { RuntimeMimicEntity } from '../runtimeTypes'
import type { EffectAttackTarget } from './effectTargeting'

export interface RuntimeEffectAttackTarget extends EffectAttackTarget {
  id: RuntimeMimicEntity
}

export function toRuntimeEffectAttackTarget(
  entity: RuntimeMimicEntity,
): RuntimeEffectAttackTarget {
  return {
    id: entity,
    role: entity.role,
    health: entity.health,
    logicalX: entity.logicalX,
    logicalY: entity.logicalY,
    jackpotPhase: entity.jackpotLifecycle?.phase ?? null,
  }
}
