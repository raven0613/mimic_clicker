import { roundConfig } from '../../configs/roundConfig'
import { evaluateWeaponDamageInterval } from '../game/damage/weaponDamageInterval'

export interface SimulatedWeaponAttempt {
  source: 'manualWeapon' | 'automaticWeapon'
  atMs: number
}

export function createWeaponAttackSchedule(
  manualIntervalMs: number,
  automaticIntervalMs: number | null,
): SimulatedWeaponAttempt[] {
  const attempts: SimulatedWeaponAttempt[] = []
  addAttempts(attempts, manualIntervalMs, 'manualWeapon')
  if (automaticIntervalMs !== null) {
    addAttempts(attempts, automaticIntervalMs, 'automaticWeapon')
  }
  return attempts.sort(
    (first, second) =>
      first.atMs - second.atMs ||
      (first.source === 'manualWeapon' ? -1 : 1),
  )
}

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

function addAttempts(
  attempts: SimulatedWeaponAttempt[],
  intervalMs: number,
  source: SimulatedWeaponAttempt['source'],
): void {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error(
      `Weapon attack schedule interval must be positive, received ${intervalMs}`,
    )
  }
  for (
    let atMs = intervalMs;
    atMs < roundConfig.durationMs;
    atMs += intervalMs
  ) {
    attempts.push({ source, atMs })
  }
}
