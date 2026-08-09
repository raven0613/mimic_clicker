import { balanceSimulationConfig } from '../../configs/balanceSimulationConfig'
import { combatConfig } from '../../configs/combatConfig'
import { effectCardConfig } from '../../configs/effectCardConfig'
import { equipmentConfig } from '../../configs/equipmentConfig'
import { jackpotConfig } from '../../configs/jackpotConfig'
import { mimicConfigs } from '../../configs/mimicConfigs'
import { roundConfig } from '../../configs/roundConfig'
import { spawnConfig } from '../../configs/spawnConfig'
import type { JackpotOutcome, MimicId } from '../../types/game'
import { calculateJackpotReward } from '../progression/progression'
import { selectWeightedMimicId } from '../spawn/spawn'
import type { EffectCardId } from '../game/attachedCards/attachedCardRules'
import {
  calculateInitialThunderDamage,
  calculateInitialMeteoriteDamage,
} from '../game/effectCards/effectCardRules'
import {
  collectMeteoriteHitTargets,
  createMeteoriteLaunchOffsets,
  createMeteoriteTrajectory,
  selectMeteoriteLandingPoint,
} from '../game/effectCards/meteoriteRules'
import { createSeededRandom } from './createSeededRandom'
import {
  selectSimulatedAttachedContent,
  selectSimulatedJackpotAttachedContent,
} from './attachedCardSimulation'
import {
  createBalanceSimulationReport,
  type BalanceSimulationReport,
} from './balanceSimulationReport'
import {
  simulateEffectCardCombat,
} from './effectCardBalanceSimulation'
import {
  simulateEquipmentCombatRound,
  type RoundEquipmentMetrics,
} from './equipmentBalanceSimulation'
import { simulateRequiredWeaponHits } from './weaponAttackSimulation'
import {
  calculateMimicFlowExitDurationMs,
  simulateSpawnStream,
} from './spawnStreamSimulation'

export type StageKey = 'normalOnly' | 'normalRare1' | 'allMimics'
type PlayerModel = keyof typeof balanceSimulationConfig.playerClickRatesPerSecond
type AccuracyModel = keyof typeof balanceSimulationConfig.accuracyRates
export type EquipmentLoadoutKey =
  keyof typeof balanceSimulationConfig.equipmentLoadouts

export interface SimulatedRound {
  stage: StageKey
  playerModel: PlayerModel
  accuracyModel: AccuracyModel
  jackpotCase: JackpotOutcome
  equipmentLoadout: EquipmentLoadoutKey
  generatedByMimic: Record<MimicId, number>
  initialFieldMimicCount: number
  defeatedByMimic: Record<MimicId, number>
  placementAttempts: number
  placementRejections: number
  ordinaryIncome: number
  jackpotIncome: number
  jackpotOpportunities: number
  jackpotRevealed: boolean
  jackpotDefeated: boolean
  jackpotEscaped: boolean
  effectCardEligibleSpawns: number
  chanceEffectCardsGenerated: Record<EffectCardId, number>
  effectCardsGenerated: Record<EffectCardId, number>
  cardsTriggered: Record<EffectCardId, number>
  attackHits: Record<EffectCardId, number>
  additionalDamage: Record<EffectCardId, number>
  effectDefeats: Record<EffectCardId, number>
  thunderStrikesTriggered: number
  meteoritesLaunched: number
  meteoriteImpacts: number
  tornadoesSpawned: number
  maximumEffectChainDepth: number
  effectChainCount: number
  maximumDefeatsInEffectChain: number
  maximumEffectChainClearRatio: number
  effectChainFullClearCount: number
  fullClearCount: number
  refillCount: number
  refilledMimicCount: number
  refilledByMimic: Record<MimicId, number>
  refilledDefeatCount: number
  refillOrdinaryIncome: number
  refillEffectCardsGenerated: Record<EffectCardId, number>
  refillEquipmentCardsGenerated: Record<'sword' | 'ring', number>
  emptyFieldDurationsMs: number[]
  suppressedEmptyFieldCount: number
  repeatedRefillsWithoutInterventionCount: number
  rare1SurvivorsAfterEffectResolution: number
  rare2SurvivorsAfterEffectResolution: number
  effectDefeatsAfterPriorWeaponDamage: number
  swordAdditionalDamage: number
  ringAdditionalDamage: number
  ringDamageStrikes: number
  equipment: RoundEquipmentMetrics
  finished: boolean
}

const stagePools: Record<StageKey, MimicId[]> = {
  normalOnly: ['normal'],
  normalRare1: ['normal', 'rare1'],
  allMimics: ['normal', 'rare1', 'rare2'],
}

function calculateJackpotOpportunities(): number {
  let opportunities = 0
  let appearanceMs = roundConfig.initialJackpotSpawnDelayMs
  while (appearanceMs < roundConfig.durationMs) {
    opportunities += 1
    appearanceMs +=
      calculateMimicFlowExitDurationMs(
        -spawnConfig.cardHeightPixels + spawnConfig.spawnYInsetPixels,
      ) +
      roundConfig.jackpotReturnBaseDelayMs +
      opportunities * roundConfig.jackpotReturnAdditionalDelayPerMissMs
  }
  return opportunities
}

function simulateRound(
  stage: StageKey,
  playerModel: PlayerModel,
  accuracyModel: AccuracyModel,
  jackpotCase: JackpotOutcome,
  equipmentLoadout: EquipmentLoadoutKey,
  seed: number,
): SimulatedRound {
  const pool = stagePools[stage]
  const spawnMetrics = simulateSpawnStream(pool, seed)
  const random = createSeededRandom(seed ^ 0x9e3779b9)
  const clickRate = balanceSimulationConfig.playerClickRatesPerSecond[playerModel]
  const accuracy = balanceSimulationConfig.accuracyRates[accuracyModel]
  const initialEquipment =
    balanceSimulationConfig.equipmentLoadouts[equipmentLoadout]
  const swordCount = initialEquipment.filter((id) => id === 'sword').length
  const ringCount = initialEquipment.filter((id) => id === 'ring').length
  const weaponDamage =
    combatConfig.initialWeaponDamage +
    swordCount * equipmentConfig.sword.weaponDamageBonus
  let landedClickBudget = roundConfig.durationMs * clickRate * accuracy / 1_000
  const shellMimicId = selectWeightedMimicId(pool, random)
  const shellAttachedContent = selectSimulatedAttachedContent(
    shellMimicId,
    random,
  )
  const shellEffectCardIds = shellAttachedContent.effectCardIds
  const shellHasThunderCard = shellEffectCardIds.includes('thunder')
  const shellHits = Math.ceil(
    mimicConfigs[shellMimicId].maximumHealth / weaponDamage,
  )
  const weaponAttemptIntervalMs = 1_000 / (clickRate * accuracy)
  const shellWeaponAttacks = simulateRequiredWeaponHits(
    shellHits,
    roundConfig.initialJackpotSpawnDelayMs,
    weaponAttemptIntervalMs,
    0,
  )
  const jackpotRevealed =
    jackpotCase !== 'notRevealed' &&
    shellWeaponAttacks.completedAtMs < roundConfig.durationMs &&
    landedClickBudget >= shellWeaponAttacks.attemptCount
  if (jackpotRevealed) {
    landedClickBudget -= shellWeaponAttacks.attemptCount
  }
  const jackpotAttachedContent = jackpotRevealed
    ? selectSimulatedJackpotAttachedContent(random)
    : null
  const jackpotEffectCardIds =
    jackpotAttachedContent?.effectCardIds ?? []
  const shellDefeatAtMs = shellWeaponAttacks.completedAtMs
  const regularTargetsAtReveal = spawnMetrics.spawnedMimics.filter(
    (mimic) => mimic.spawnedAtMs <= shellDefeatAtMs,
  ).length
  const shellThunderHitsJackpot =
    jackpotRevealed &&
    shellHasThunderCard &&
    Math.floor(random() * (regularTargetsAtReveal + 1)) ===
      regularTargetsAtReveal
  const shellMeteoriteLaunchOffsets = shellEffectCardIds.includes('meteorite')
    ? createMeteoriteLaunchOffsets(
        effectCardConfig.meteorite.initialMeteoriteCount,
        random,
      )
    : []
  const shellMeteoriteLandings = shellMeteoriteLaunchOffsets.map(() =>
    selectMeteoriteLandingPoint(
      {
        width: balanceSimulationConfig.field.widthPixels,
        height: balanceSimulationConfig.field.heightPixels,
      },
      random,
    ),
  )
  const jackpotTarget = {
    id: -1,
    role: 'jackpot' as const,
    health: jackpotConfig.maximumHealth,
    logicalX: balanceSimulationConfig.field.widthPixels / 2,
    logicalY: balanceSimulationConfig.field.heightPixels / 2,
    jackpotPhase: 'chasing' as const,
  }
  const shellMeteoriteHitsJackpot = shellMeteoriteLandings.filter(
    (landing, index) => {
      const trajectory = createMeteoriteTrajectory(
        {
          width: balanceSimulationConfig.field.widthPixels,
          height: balanceSimulationConfig.field.heightPixels,
        },
        landing,
      )
      const impactDelayMs =
        effectCardConfig.ejection.durationMs +
        shellMeteoriteLaunchOffsets[index] +
        (trajectory.distance /
          effectCardConfig.meteorite.flightSpeedPixelsPerSecond) *
          1_000
      return (
        impactDelayMs < jackpotConfig.chaseDurationMs &&
        collectMeteoriteHitTargets([jackpotTarget], landing).length > 0
      )
    },
  ).length
  const jackpotHealthBeforeClicks = Math.max(
    0,
    jackpotConfig.maximumHealth -
      (shellThunderHitsJackpot ? calculateInitialThunderDamage() : 0) -
      shellMeteoriteHitsJackpot * calculateInitialMeteoriteDamage(),
  )
  const jackpotHits = Math.ceil(
    jackpotHealthBeforeClicks / weaponDamage,
  )
  const jackpotWeaponAttacks = simulateRequiredWeaponHits(
    jackpotHits,
    shellDefeatAtMs,
    weaponAttemptIntervalMs,
    shellWeaponAttacks.nextAllowedAtMs,
  )
  const jackpotDefeated =
    jackpotCase === 'defeated' &&
    jackpotRevealed &&
    jackpotWeaponAttacks.completedAtMs - shellDefeatAtMs <=
      jackpotConfig.chaseDurationMs &&
    landedClickBudget >= jackpotWeaponAttacks.attemptCount
  if (jackpotDefeated) {
    landedClickBudget -= jackpotWeaponAttacks.attemptCount
  }

  const scheduledCardEvents = []
  if (jackpotRevealed) {
    for (const id of shellEffectCardIds) {
      if (id === 'thunder' && shellThunderHitsJackpot) continue
      scheduledCardEvents.push({
        id,
        readyAtMs: shellDefeatAtMs + effectCardConfig.ejection.durationMs,
        chainDepth: 1,
        meteoriteLandings:
          id === 'meteorite' ? shellMeteoriteLandings : undefined,
        meteoriteLaunchOffsetsMs:
          id === 'meteorite' ? shellMeteoriteLaunchOffsets : undefined,
        sourcePosition: {
          x: balanceSimulationConfig.field.widthPixels / 2,
          y: balanceSimulationConfig.field.heightPixels / 2,
        },
      })
    }
  }
  if (jackpotDefeated) {
    const jackpotDefeatAtMs = jackpotWeaponAttacks.completedAtMs
    for (const id of jackpotEffectCardIds) {
      scheduledCardEvents.push({
        id,
        readyAtMs: jackpotDefeatAtMs + effectCardConfig.ejection.durationMs,
        chainDepth: 1,
        sourcePosition: {
          x: balanceSimulationConfig.field.widthPixels / 2,
          y: balanceSimulationConfig.field.heightPixels / 2,
        },
      })
    }
  }

  const combatMetrics = simulateEffectCardCombat(
    spawnMetrics.spawnedMimics,
    landedClickBudget,
    clickRate,
    accuracy,
    random,
    scheduledCardEvents,
    weaponDamage,
    ringCount,
  )
  const equipmentRandom = createSeededRandom(seed ^ 0x85ebca6b)
  const equipment = simulateEquipmentCombatRound({
    ordinaryMimics: spawnMetrics.spawnedMimics,
    shellMimicId,
    shellContent: shellAttachedContent,
    jackpotContent: selectSimulatedJackpotAttachedContent(equipmentRandom),
    jackpotReward: calculateJackpotReward(pool),
    jackpotCase,
    initialLoadout: initialEquipment,
    clickRate,
    accuracy,
    random: equipmentRandom,
  })
  const generatedEffectCardIds = [
    ...spawnMetrics.spawnedMimics.flatMap((mimic) => mimic.effectCardIds),
    ...shellEffectCardIds,
    ...jackpotEffectCardIds,
  ]
  const chanceGeneratedEffectCardIds = [
    ...spawnMetrics.spawnedMimics.flatMap((mimic) => mimic.effectCardIds),
    ...shellEffectCardIds,
  ]
  const directThunderHit = Number(shellThunderHitsJackpot)
  const directMeteoriteHits = shellMeteoriteHitsJackpot
  const cardsTriggered = {
    ...combatMetrics.cardsTriggered,
    thunder: combatMetrics.cardsTriggered.thunder + directThunderHit,
  }
  const attackHits = {
    ...combatMetrics.attackHits,
    thunder: combatMetrics.attackHits.thunder + directThunderHit,
    meteorite: combatMetrics.attackHits.meteorite + directMeteoriteHits,
  }
  const additionalDamage = {
    ...combatMetrics.additionalDamage,
    thunder:
      combatMetrics.additionalDamage.thunder +
      directThunderHit * calculateInitialThunderDamage(),
    meteorite:
      combatMetrics.additionalDamage.meteorite +
      directMeteoriteHits * calculateInitialMeteoriteDamage(),
  }
  const generatedByMimic = { ...spawnMetrics.generatedByMimic }
  for (const mimicId of Object.keys(generatedByMimic) as MimicId[]) {
    generatedByMimic[mimicId] += combatMetrics.refilledByMimic[mimicId]
  }
  const chanceEffectCardsGenerated = addEffectCounts(
    countEffectCards(chanceGeneratedEffectCardIds),
    combatMetrics.refillEffectCardsGenerated,
  )
  const effectCardsGenerated = addEffectCounts(
    countEffectCards(generatedEffectCardIds),
    combatMetrics.refillEffectCardsGenerated,
  )
  return {
    stage,
    playerModel,
    accuracyModel,
    jackpotCase,
    equipmentLoadout,
    generatedByMimic,
    initialFieldMimicCount: spawnMetrics.initialFieldMimicCount,
    placementAttempts: spawnMetrics.placementAttempts,
    placementRejections: spawnMetrics.placementRejections,
    ...combatMetrics,
    jackpotIncome: jackpotDefeated ? calculateJackpotReward(pool) : 0,
    jackpotOpportunities:
      jackpotCase === 'notRevealed' ? calculateJackpotOpportunities() : 1,
    jackpotRevealed,
    jackpotDefeated,
    jackpotEscaped: jackpotRevealed && !jackpotDefeated,
    effectCardEligibleSpawns:
      spawnMetrics.spawnedMimics.length +
      combatMetrics.refilledMimicCount +
      1,
    chanceEffectCardsGenerated,
    effectCardsGenerated,
    cardsTriggered,
    attackHits,
    additionalDamage,
    effectDefeats: combatMetrics.defeats,
    thunderStrikesTriggered:
      combatMetrics.thunderStrikesTriggered +
      Number(shellThunderHitsJackpot) *
        effectCardConfig.thunder.initialStrikeCount,
    meteoritesLaunched: combatMetrics.meteoritesLaunched,
    meteoriteImpacts: combatMetrics.meteoriteImpacts,
    tornadoesSpawned: combatMetrics.tornadoesSpawned,
    maximumEffectChainDepth: combatMetrics.maximumEffectChainDepth,
    swordAdditionalDamage: equipment.swordAdditionalDamage,
    ringAdditionalDamage: equipment.ringAdditionalDamage,
    ringDamageStrikes: equipment.ringDamageStrikes,
    equipment,
    finished: true,
  }
}

function countEffectCards(ids: readonly EffectCardId[]): Record<EffectCardId, number> {
  return {
    thunder: ids.filter((id) => id === 'thunder').length,
    meteorite: ids.filter((id) => id === 'meteorite').length,
    tornado: ids.filter((id) => id === 'tornado').length,
  }
}

function addEffectCounts(
  first: Record<EffectCardId, number>,
  second: Record<EffectCardId, number>,
): Record<EffectCardId, number> {
  return {
    thunder: first.thunder + second.thunder,
    meteorite: first.meteorite + second.meteorite,
    tornado: first.tornado + second.tornado,
  }
}

export function runBalanceSimulation(): BalanceSimulationReport {
  const rounds: SimulatedRound[] = []
  for (const stage of Object.keys(stagePools) as StageKey[]) {
    for (const playerModel of Object.keys(
      balanceSimulationConfig.playerClickRatesPerSecond,
    ) as PlayerModel[]) {
      for (const accuracyModel of Object.keys(
        balanceSimulationConfig.accuracyRates,
      ) as AccuracyModel[]) {
        for (const jackpotCase of balanceSimulationConfig.jackpotCases) {
          for (const equipmentLoadout of Object.keys(
            balanceSimulationConfig.equipmentLoadouts,
          ) as EquipmentLoadoutKey[]) {
            for (const seed of balanceSimulationConfig.seeds) {
              rounds.push(
                simulateRound(
                  stage,
                  playerModel,
                  accuracyModel,
                  jackpotCase,
                  equipmentLoadout,
                  seed,
                ),
              )
            }
          }
        }
      }
    }
  }

  return createBalanceSimulationReport(rounds, stagePools)
}

export type { BalanceSimulationReport } from './balanceSimulationReport'
