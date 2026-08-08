import { combatConfig } from '../../../configs/combatConfig'

export interface WeaponDamageIntervalResult {
  isAllowed: boolean
  nextAllowedAtMs: number
}

export function evaluateWeaponDamageInterval(
  nextAllowedAtMs: number,
  attackAtMs: number,
): WeaponDamageIntervalResult {
  if (attackAtMs < nextAllowedAtMs) {
    return { isAllowed: false, nextAllowedAtMs }
  }
  return {
    isAllowed: true,
    nextAllowedAtMs:
      attackAtMs + combatConfig.minimumWeaponDamageIntervalPerTargetMs,
  }
}
