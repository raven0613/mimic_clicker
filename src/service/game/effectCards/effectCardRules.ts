import { combatConfig } from '../../../configs/combatConfig'
import { effectCardConfig } from '../../../configs/effectCardConfig'

export interface EffectCardWindupProgress {
  elapsedMs: number
  isReady: boolean
}

export function calculateInitialThunderDamage(): number {
  return (
    combatConfig.initialWeaponDamage *
    effectCardConfig.thunder.initialWeaponDamageMultiplier
  )
}

export function calculateInitialMeteoriteDamage(): number {
  return (
    combatConfig.initialWeaponDamage *
    effectCardConfig.meteorite.initialWeaponDamageMultiplier
  )
}

export function calculateInitialTornadoDamage(): number {
  return (
    combatConfig.initialWeaponDamage *
    effectCardConfig.tornado.initialWeaponDamageMultiplier
  )
}

export function advanceEffectCardWindup(
  elapsedMs: number,
  deltaMs: number,
): EffectCardWindupProgress {
  const nextElapsedMs = Math.min(
    effectCardConfig.ejection.durationMs,
    elapsedMs + Math.max(0, deltaMs),
  )
  return {
    elapsedMs: nextElapsedMs,
    isReady: nextElapsedMs === effectCardConfig.ejection.durationMs,
  }
}
