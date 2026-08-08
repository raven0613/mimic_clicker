import { evaluateWeaponDamageInterval } from '../game/damage/weaponDamageInterval'

export interface SimulatedRequiredWeaponHits {
  attemptCount: number
  completedAtMs: number
  nextAllowedAtMs: number
}

export function simulateRequiredWeaponHits(
  requiredHitCount: number,
  startAtMs: number,
  attemptIntervalMs: number,
  initialNextAllowedAtMs: number,
): SimulatedRequiredWeaponHits {
  if (!Number.isInteger(requiredHitCount) || requiredHitCount < 0) {
    throw new Error(
      `Weapon simulation requires a non-negative integer hit count, received ${requiredHitCount}`,
    )
  }
  if (!Number.isFinite(attemptIntervalMs) || attemptIntervalMs <= 0) {
    throw new Error(
      `Weapon simulation requires a positive attempt interval, received ${attemptIntervalMs}`,
    )
  }

  let acceptedHitCount = 0
  let attemptCount = 0
  let completedAtMs = startAtMs
  let nextAllowedAtMs = initialNextAllowedAtMs
  while (acceptedHitCount < requiredHitCount) {
    attemptCount += 1
    const attemptAtMs = startAtMs + attemptIntervalMs * attemptCount
    const interval = evaluateWeaponDamageInterval(
      nextAllowedAtMs,
      attemptAtMs,
    )
    if (!interval.isAllowed) continue
    acceptedHitCount += 1
    completedAtMs = attemptAtMs
    nextAllowedAtMs = interval.nextAllowedAtMs
  }
  return { attemptCount, completedAtMs, nextAllowedAtMs }
}
