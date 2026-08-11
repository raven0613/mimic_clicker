import { effectCardConfig } from '../../../configs/effectCardConfig'
import { getInitialWeaponDefinition } from '../../progression/weaponProgression'

export interface EffectCardWindupProgress {
  elapsedMs: number
  isReady: boolean
}

export function calculateInitialThunderDamage(): number {
  return (
    getInitialWeaponDefinition().baseDamage *
    effectCardConfig.thunder.initialWeaponDamageMultiplier
  )
}

export function calculateInitialMeteoriteDamage(): number {
  return (
    getInitialWeaponDefinition().baseDamage *
    effectCardConfig.meteorite.initialWeaponDamageMultiplier
  )
}

export function calculateInitialTornadoDamage(): number {
  return (
    getInitialWeaponDefinition().baseDamage *
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
