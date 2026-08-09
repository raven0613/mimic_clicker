import { combatConfig } from '../../../configs/combatConfig'

export interface WeaponDamageIntervalResult {
  isAllowed: boolean
  nextAllowedAtMs: number
}

export function evaluateWeaponDamageInterval(
  nextAllowedAtMs: number,
  attackAtMs: number,
): WeaponDamageIntervalResult {
  const boundaryToleranceMs =
    Number.EPSILON *
    Math.max(1, Math.abs(nextAllowedAtMs), Math.abs(attackAtMs)) *
    4
  if (attackAtMs + boundaryToleranceMs < nextAllowedAtMs) {
    return { isAllowed: false, nextAllowedAtMs }
  }
  return {
    isAllowed: true,
    nextAllowedAtMs:
      attackAtMs + combatConfig.minimumWeaponDamageIntervalPerTargetMs,
  }
}
