import { balanceSimulationConfig } from '../../configs/balanceSimulationConfig'
import { combatConfig } from '../../configs/combatConfig'
import { effectCardConfig } from '../../configs/effectCardConfig'
import { mimicConfigs } from '../../configs/mimicConfigs'
import { roundConfig } from '../../configs/roundConfig'
import { spawnConfig } from '../../configs/spawnConfig'
import type { MimicId, RandomSource } from '../../types/game'
import { calculateInitialThunderDamage } from '../game/effectCards/effectCardRules'
import {
  collectThunderHitTargets,
  selectThunderTarget,
  type ThunderTarget,
} from '../game/effectCards/thunderTargeting'

export interface BalanceCombatMimic extends ThunderTarget {
  id: number
  mimicId: MimicId
  spawnedAtMs: number
  initialY: number
  hasThunderCard: boolean
}

export interface SimulatedThunderEvent {
  readyAtMs: number
  chainDepth: number
}

export interface EffectCardCombatMetrics {
  defeatedByMimic: Record<MimicId, number>
  ordinaryIncome: number
  thunderStrikesTriggered: number
  thunderDefeats: number
  maximumThunderChainDepth: number
}

function emptyMimicCounts(): Record<MimicId, number> {
  return { normal: 0, rare1: 0, rare2: 0 }
}

export function simulateEffectCardCombat(
  sourceMimics: readonly BalanceCombatMimic[],
  availableClickBudget: number,
  clickRate: number,
  accuracy: number,
  random: RandomSource,
  scheduledThunderEvents: readonly SimulatedThunderEvent[] = [],
): EffectCardCombatMetrics {
  const mimics = sourceMimics.map((mimic) => ({ ...mimic }))
  const defeatedByMimic = emptyMimicCounts()
  const pendingThunder = scheduledThunderEvents.map((event) => ({ ...event }))
  const movementSpeed =
    (balanceSimulationConfig.field.heightPixels +
      spawnConfig.cardHeightPixels * 2) /
    (roundConfig.mimicFieldTravelDurationMs / 1_000)
  let ordinaryIncome = 0
  let thunderStrikesTriggered = 0
  let thunderDefeats = 0
  let maximumThunderChainDepth = 0

  const getActiveMimics = (atMs: number) =>
    mimics.filter((mimic) => {
      mimic.logicalY =
        mimic.initialY + movementSpeed * ((atMs - mimic.spawnedAtMs) / 1_000)
      return (
        mimic.spawnedAtMs <= atMs &&
        atMs - mimic.spawnedAtMs < roundConfig.mimicFieldTravelDurationMs &&
        mimic.health !== null &&
        mimic.health > 0
      )
    })

  const defeatMimic = (
    mimic: BalanceCombatMimic,
    atMs: number,
    chainDepth: number,
    defeatedByThunder: boolean,
  ) => {
    defeatedByMimic[mimic.mimicId] += 1
    ordinaryIncome += mimicConfigs[mimic.mimicId].baseReward
    if (defeatedByThunder) thunderDefeats += 1
    if (mimic.hasThunderCard) {
      pendingThunder.push({
        readyAtMs: atMs + effectCardConfig.ejection.durationMs,
        chainDepth: chainDepth + 1,
      })
    }
  }

  const triggerThunder = (event: SimulatedThunderEvent) => {
    maximumThunderChainDepth = Math.max(
      maximumThunderChainDepth,
      event.chainDepth,
    )
    const selectedMimics = new Set<number>()
    for (
      let strikeIndex = 0;
      strikeIndex < effectCardConfig.thunder.initialStrikeCount;
      strikeIndex += 1
    ) {
      const activeMimics = getActiveMimics(event.readyAtMs)
      const selected = selectThunderTarget(activeMimics, selectedMimics, random)
      thunderStrikesTriggered += 1
      if (!selected) continue
      selectedMimics.add(selected.id)
      for (const hit of collectThunderHitTargets(activeMimics, selected)) {
        if (hit.health === null || hit.health <= 0) continue
        hit.health = Math.max(0, hit.health - calculateInitialThunderDamage())
        if (hit.health === 0) {
          defeatMimic(hit, event.readyAtMs, event.chainDepth, true)
        }
      }
    }
  }

  const processThunderThrough = (throughMs: number) => {
    while (true) {
      pendingThunder.sort((first, second) => first.readyAtMs - second.readyAtMs)
      const event = pendingThunder[0]
      if (!event || event.readyAtMs > throughMs) return
      pendingThunder.shift()
      triggerThunder(event)
    }
  }

  const clickIntervalMs = 1_000 / (clickRate * accuracy)
  const clickCount = Math.floor(availableClickBudget)
  for (let clickIndex = 0; clickIndex < clickCount; clickIndex += 1) {
    const clickAtMs = (clickIndex + 1) * clickIntervalMs
    if (clickAtMs >= roundConfig.durationMs) break
    processThunderThrough(clickAtMs)
    const target = getActiveMimics(clickAtMs)[0]
    if (!target || target.health === null) continue
    target.health = Math.max(0, target.health - combatConfig.initialWeaponDamage)
    if (target.health === 0) defeatMimic(target, clickAtMs, 0, false)
  }
  processThunderThrough(roundConfig.durationMs)

  return {
    defeatedByMimic,
    ordinaryIncome,
    thunderStrikesTriggered,
    thunderDefeats,
    maximumThunderChainDepth,
  }
}
