import { describe, expect, it } from 'vitest'

import { balanceSimulationConfig } from '../../configs/balanceSimulationConfig'
import { equipmentConfig } from '../../configs/equipmentConfig'
import { mimicConfigs } from '../../configs/mimicConfigs'
import { permanentUpgradeConfig } from '../../configs/permanentUpgradeConfig'
import { roundConfig } from '../../configs/roundConfig'
import { simulateEquipmentCombatRound } from './equipmentBalanceSimulation'
import type { SimulatedAttachedContent } from './attachedCardSimulation'

const noAttachedContent: SimulatedAttachedContent = {
  effectCardIds: [],
  visibleEquipmentIds: [],
  hiddenEquipmentId: null,
}

describe('equipment combat balance simulation', () => {
  it('feeds an acquired Sword back into later same-round weapon damage', () => {
    const metrics = simulateEquipmentCombatRound({
      ordinaryMimics: [
        createMimic(0, 0, { hiddenEquipmentId: 'sword' }),
        createMimic(
          1,
          roundConfig.initialJackpotSpawnDelayMs * 2,
        ),
      ],
      shellMimicId: 'normal',
      shellContent: noAttachedContent,
      jackpotContent: noAttachedContent,
      jackpotReward: mimicConfigs.normal.baseReward,
      jackpotCase: 'notRevealed',
      initialLoadout: [],
      clickRate:
        balanceSimulationConfig.playerClickRatesPerSecond.target,
      accuracy: balanceSimulationConfig.accuracyRates.high,
      random: () => 0,
    })

    expect(metrics.equipped.sword).toBe(1)
    expect(metrics.swordAdditionalDamage).toBeGreaterThanOrEqual(
      equipmentConfig.sword.weaponDamageBonus,
    )
  })

  it('runs delayed Ring strikes against the shared shell and true identity', () => {
    const metrics = simulateEquipmentCombatRound({
      ordinaryMimics: [],
      shellMimicId: 'normal',
      shellContent: noAttachedContent,
      jackpotContent: noAttachedContent,
      jackpotReward: mimicConfigs.normal.baseReward,
      jackpotCase: 'defeated',
      initialLoadout: ['ring', 'ring'],
      clickRate: balanceSimulationConfig.playerClickRatesPerSecond.fast,
      accuracy: balanceSimulationConfig.accuracyRates.high,
      random: () => 0,
    })

    expect(metrics.jackpotRevealed).toBe(true)
    expect(metrics.jackpotDefeated).toBe(true)
    expect(metrics.ringDamageStrikes).toBeGreaterThan(0)
    expect(metrics.ringAdditionalDamage).toBeGreaterThan(0)
  })

  it('does not count backpack collection as equipment activation', () => {
    const metrics = simulateEquipmentCombatRound({
      ordinaryMimics: [
        createMimic(0, 0, { hiddenEquipmentId: 'sword' }),
      ],
      shellMimicId: 'normal',
      shellContent: noAttachedContent,
      jackpotContent: noAttachedContent,
      jackpotReward: mimicConfigs.normal.baseReward,
      jackpotCase: 'notRevealed',
      initialLoadout: ['sword', 'sword'],
      clickRate: balanceSimulationConfig.playerClickRatesPerSecond.fast,
      accuracy: balanceSimulationConfig.accuracyRates.high,
      random: () => 0,
    })

    expect(metrics.backpack.sword).toBe(1)
    expect(metrics.activationCount).toBe(0)
  })

  it('applies the configured management policy after a backpack arrival', () => {
    const metrics = simulateEquipmentCombatRound({
      ordinaryMimics: [
        createMimic(0, 0, { hiddenEquipmentId: 'sword' }),
        createMimic(1, roundConfig.initialJackpotSpawnDelayMs * 2),
      ],
      shellMimicId: 'normal',
      shellContent: noAttachedContent,
      jackpotContent: noAttachedContent,
      jackpotReward: mimicConfigs.normal.baseReward,
      jackpotCase: 'notRevealed',
      initialLoadout: ['ring'],
      equipmentSlotCount: 1,
      backpackManagementPolicy: 'swordPriority',
      clickRate: balanceSimulationConfig.playerClickRatesPerSecond.fast,
      accuracy: balanceSimulationConfig.accuracyRates.high,
      random: () => 0,
    })

    expect(metrics.switchCount).toBe(1)
    expect(metrics.swordAdditionalDamage).toBeGreaterThan(0)
  })

  it('simulates permanent weapon damage without counting it as Sword damage', () => {
    const metrics = simulateEquipmentCombatRound({
      ordinaryMimics: [createMimic(0, 0)],
      shellMimicId: 'normal',
      shellContent: noAttachedContent,
      jackpotContent: noAttachedContent,
      jackpotReward: mimicConfigs.normal.baseReward,
      jackpotCase: 'notRevealed',
      initialLoadout: [],
      baseWeaponDamage:
        permanentUpgradeConfig.weaponDamage.damageByLevel[
          permanentUpgradeConfig.weaponDamage.damageByLevel.length - 1
        ],
      clickRate: balanceSimulationConfig.playerClickRatesPerSecond.target,
      accuracy: balanceSimulationConfig.accuracyRates.target,
      random: () => 0,
    })

    expect(metrics.manualWeaponHits).toBeGreaterThan(0)
    expect(metrics.manualWeaponDamage).toBeGreaterThan(0)
    expect(metrics.swordAdditionalDamage).toBe(0)
  })

  it('tracks automatic weapon attempts separately from manual Ring hits', () => {
    const metrics = simulateEquipmentCombatRound({
      ordinaryMimics: [createMimic(0, 0)],
      shellMimicId: 'normal',
      shellContent: noAttachedContent,
      jackpotContent: noAttachedContent,
      jackpotReward: mimicConfigs.normal.baseReward,
      jackpotCase: 'notRevealed',
      initialLoadout: ['ring'],
      automaticAttackIntervalMs:
        permanentUpgradeConfig.hoverAutoAttack.intervalMsByLevel[
          permanentUpgradeConfig.hoverAutoAttack.intervalMsByLevel.length - 1
        ],
      clickRate: balanceSimulationConfig.playerClickRatesPerSecond.slow,
      accuracy: balanceSimulationConfig.accuracyRates.low,
      random: () => 0,
    })

    expect(metrics.automaticWeaponHits).toBeGreaterThan(0)
    expect(metrics.automaticWeaponDamage).toBeGreaterThan(0)
    expect(metrics.ringDamageStrikes).toBe(0)
  })
})

function createMimic(
  id: number,
  spawnedAtMs: number,
  content: { hiddenEquipmentId?: 'sword' | 'ring' } = {},
) {
  return {
    id,
    mimicId: 'normal' as const,
    spawnedAtMs,
    initialY: 0,
    effectCardIds: [],
    visibleEquipmentIds: [],
    hiddenEquipmentId: content.hiddenEquipmentId ?? null,
    health: mimicConfigs.normal.maximumHealth,
  }
}
