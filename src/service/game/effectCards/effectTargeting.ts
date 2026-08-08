import type { JackpotLifecycle } from '../../combat/combat'

export interface EffectAttackTarget {
  id: unknown
  role: 'regular' | 'jackpotDisguise' | 'jackpot'
  health: number | null
  logicalX: number
  logicalY: number
  jackpotPhase: JackpotLifecycle['phase'] | null
}

export function isEligibleEffectAttackTarget(
  target: EffectAttackTarget,
): boolean {
  if (target.health === null || target.health <= 0) return false
  return target.role !== 'jackpot' || target.jackpotPhase === 'chasing'
}
