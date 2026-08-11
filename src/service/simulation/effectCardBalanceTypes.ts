import type { EquipmentId } from '../../configs/equipmentConfig'
import type { MimicId, Vector2 } from '../../types/game'
import type { EffectCardId } from '../game/attachedCards/attachedCardRules'
import type { TornadoMotionState } from '../game/effectCards/tornadoRules'
import type { ThunderTarget } from '../game/effectCards/thunderTargeting'

export interface BalanceCombatMimic extends ThunderTarget {
  id: number
  mimicId: MimicId
  spawnedAtMs: number
  initialY: number
  effectCardIds: EffectCardId[]
  visibleEquipmentIds: EquipmentId[]
  hiddenEquipmentId: EquipmentId | null
}

export interface SimulatedCombatMimic extends BalanceCombatMimic {
  isRefill: boolean
  nextWeaponDamageAllowedAtMs: number
  weaponDamageTaken: number
}

export interface SimulatedEffectCardEvent {
  id: EffectCardId
  readyAtMs: number
  chainDepth: number
  chainId?: number
  meteoriteLandings?: Vector2[]
  meteoriteLaunchOffsetsMs?: number[]
  sourcePosition?: Vector2
}

export interface PendingCardEvent extends SimulatedEffectCardEvent {
  kind: 'card'
  chainId: number
}

export interface SimulatedMeteoriteImpact {
  kind: 'meteoriteImpact'
  impactAtMs: number
  landing: Vector2
  chainDepth: number
  chainId: number
}

export interface SimulatedTornadoTick {
  kind: 'tornadoTick'
  tickAtMs: number
  runEndsAtMs: number
  motion: TornadoMotionState
  nextDamageAllowedAtMsByTarget: Map<number, number>
  chainDepth: number
  chainId: number
}

export interface SimulatedClearConfirmation {
  kind: 'clearConfirmation'
  confirmAtMs: number
  chainId: number | null
}

export interface SimulatedRingStrike {
  kind: 'ringStrike'
  strikeAtMs: number
  targetId: number
  damage: number
  chainId: null
}

export type PendingEffectEvent =
  | PendingCardEvent
  | SimulatedMeteoriteImpact
  | SimulatedTornadoTick
  | SimulatedClearConfirmation
  | SimulatedRingStrike

export interface EffectCardCombatMetrics {
  defeatedByMimic: Record<MimicId, number>
  ordinaryIncome: number
  cardsTriggered: Record<EffectCardId, number>
  attackHits: Record<EffectCardId, number>
  additionalDamage: Record<EffectCardId, number>
  defeats: Record<EffectCardId, number>
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
  refillEquipmentCardsGenerated: Record<EquipmentId, number>
  emptyFieldDurationsMs: number[]
  refillEffectiveTargetCountsBefore: number[]
  refillEffectiveTargetCountsAfter: number[]
  refillTargetShortfalls: number[]
  jackpotChaseRefillCount: number
  suppressedRefillCount: number
  repeatedRefillsWithoutInterventionCount: number
  rare1SurvivorsAfterEffectResolution: number
  rare2SurvivorsAfterEffectResolution: number
  effectDefeatsAfterPriorWeaponDamage: number
}
