import { clearRefillConfig } from '../../configs/clearRefillConfig'
import type { EquipmentId } from '../../configs/equipmentConfig'
import { mimicConfigs } from '../../configs/mimicConfigs'
import { roundConfig } from '../../configs/roundConfig'
import { spawnConfig } from '../../configs/spawnConfig'
import type { MimicId, RandomSource } from '../../types/game'
import {
  createFieldFillSpawnArea,
  selectSpawnPositionsUntilFull,
  selectWeightedMimicId,
} from '../spawn/spawn'
import { selectSimulatedAttachedContent } from './attachedCardSimulation'
import type { EffectCardId } from '../game/attachedCards/attachedCardRules'
import type {
  BalanceCombatMimic,
  EffectCardCombatMetrics,
  PendingEffectEvent,
  SimulatedClearConfirmation,
  SimulatedCombatMimic,
} from './effectCardBalanceTypes'

interface ClearRefillBalanceTrackerInput {
  enqueueEvent: (event: PendingEffectEvent) => void
  field: { widthPixels: number; heightPixels: number }
  getActiveMimics: (atMs: number) => SimulatedCombatMimic[]
  getEffectiveMimics: (atMs: number) => SimulatedCombatMimic[]
  markEffectChainFullClear: (chainId: number, atMs: number) => void
  mimicPool: MimicId[]
  mimics: SimulatedCombatMimic[]
  pendingEvents: PendingEffectEvent[]
  random: RandomSource
}

interface CreateSimulatedFieldRefillInput {
  activeMimics: readonly BalanceCombatMimic[]
  atMs: number
  field: { widthPixels: number; heightPixels: number }
  mimicPool: MimicId[]
  nextMimicId: number
  random: RandomSource
  maximumNewMimicCount: number
}

export function createSimulatedFieldRefill(
  input: CreateSimulatedFieldRefillInput,
): BalanceCombatMimic[] {
  const positions = selectSpawnPositionsUntilFull(
    {
      fieldWidth: input.field.widthPixels,
      cardWidth: spawnConfig.cardWidthPixels,
      cardHeight: spawnConfig.cardHeightPixels,
      ...createFieldFillSpawnArea(input.field.heightPixels),
      occupiedBounds: input.activeMimics.map((mimic) => ({
        x: mimic.logicalX - spawnConfig.cardWidthPixels / 2,
        y: mimic.logicalY - spawnConfig.cardHeightPixels / 2,
        width: spawnConfig.cardWidthPixels,
        height: spawnConfig.cardHeightPixels,
      })),
      maximumPositionCount:
        Math.min(
          input.maximumNewMimicCount,
          spawnConfig.maximumConcurrentMimics - input.activeMimics.length,
        ),
    },
    input.random,
  )

  return positions.map((position, index) => {
    const mimicId = selectWeightedMimicId(input.mimicPool, input.random)
    return {
      id: input.nextMimicId + index,
      mimicId,
      role: 'regular',
      health: mimicConfigs[mimicId].maximumHealth,
      logicalX: position.x + spawnConfig.cardWidthPixels / 2,
      logicalY: position.y + spawnConfig.cardHeightPixels / 2,
      jackpotPhase: null,
      spawnedAtMs: input.atMs,
      initialY: position.y + spawnConfig.cardHeightPixels / 2,
      ...selectSimulatedAttachedContent(mimicId, input.random),
    }
  })
}

export class ClearRefillBalanceTracker {
  private readonly input: ClearRefillBalanceTrackerInput
  private readonly refillEffectCardsGenerated = emptyEffectCounts()
  private readonly refillEquipmentCardsGenerated: Record<EquipmentId, number> = {
    sword: 0,
    ring: 0,
  }
  private readonly emptyFieldDurationsMs: number[] = []
  private readonly refillEffectiveTargetCountsBefore: number[] = []
  private readonly refillEffectiveTargetCountsAfter: number[] = []
  private readonly refillTargetShortfalls: number[] = []
  private fullClearCount = 0
  private refillCount = 0
  private refilledMimicCount = 0
  private refilledDefeatCount = 0
  private refillOrdinaryIncome = 0
  private jackpotChaseRefillCount = 0
  private suppressedRefillCount = 0
  private repeatedRefillsWithoutInterventionCount = 0
  private pendingConfirmation = false
  private refillLocked = false
  private lockingChainId: number | null = null

  public constructor(input: ClearRefillBalanceTrackerInput) {
    this.input = input
  }

  public request(atMs: number, chainId: number | null): void {
    const effectiveTargetCount = this.input.getEffectiveMimics(atMs).length
    if (
      this.pendingConfirmation ||
      effectiveTargetCount >
        clearRefillConfig.triggerMaximumEffectiveTargetCount ||
      this.isJackpotChaseActive(atMs) ||
      roundConfig.durationMs - atMs < clearRefillConfig.minimumRemainingRoundMs
    ) {
      return
    }
    if (this.refillLocked) {
      this.suppressedRefillCount += 1
      return
    }
    this.pendingConfirmation = true
    this.input.enqueueEvent({
      kind: 'clearConfirmation',
      confirmAtMs: atMs + clearRefillConfig.confirmationDelayMs,
      chainId,
    })
  }

  public processConfirmation(event: SimulatedClearConfirmation): void {
    this.pendingConfirmation = false
    const effectiveTargetCount = this.input.getEffectiveMimics(
      event.confirmAtMs,
    ).length
    if (
      event.confirmAtMs >= roundConfig.durationMs ||
      roundConfig.durationMs - event.confirmAtMs <
        clearRefillConfig.minimumRemainingRoundMs ||
      effectiveTargetCount >
        clearRefillConfig.triggerMaximumEffectiveTargetCount ||
      this.isJackpotChaseActive(event.confirmAtMs)
    ) {
      return
    }
    if (this.refillLocked) {
      this.repeatedRefillsWithoutInterventionCount += 1
      return
    }

    const isFullClear = effectiveTargetCount === 0
    if (isFullClear) this.fullClearCount += 1
    if (isFullClear && event.chainId !== null) {
      this.input.markEffectChainFullClear(event.chainId, event.confirmAtMs)
    }

    const refillMimics = createSimulatedFieldRefill({
      activeMimics: this.input.getActiveMimics(event.confirmAtMs),
      atMs: event.confirmAtMs,
      field: this.input.field,
      mimicPool: this.input.mimicPool,
      nextMimicId:
        Math.max(-1, ...this.input.mimics.map((mimic) => mimic.id)) + 1,
      random: this.input.random,
      maximumNewMimicCount:
        clearRefillConfig.targetEffectiveCount - effectiveTargetCount,
    }).map<SimulatedCombatMimic>((mimic) => ({
      ...mimic,
      isRefill: true,
      nextWeaponDamageAllowedAtMs: 0,
      weaponDamageTaken: 0,
    }))
    this.input.mimics.push(...refillMimics)
    const effectiveTargetCountAfter = this.input.getEffectiveMimics(
      event.confirmAtMs,
    ).length
    this.refillCount += 1
    this.refilledMimicCount += refillMimics.length
    this.refillEffectiveTargetCountsBefore.push(effectiveTargetCount)
    this.refillEffectiveTargetCountsAfter.push(effectiveTargetCountAfter)
    this.refillTargetShortfalls.push(
      Math.max(
        0,
        clearRefillConfig.targetEffectiveCount - effectiveTargetCountAfter,
      ),
    )
    if (isFullClear && refillMimics.length > 0) {
      this.emptyFieldDurationsMs.push(clearRefillConfig.confirmationDelayMs)
    }
    for (const mimic of refillMimics) this.recordGeneratedContent(mimic)
    this.refillLocked = true
    this.lockingChainId = event.chainId
  }

  public notifyValidManualWeaponDamage(): void {
    this.refillLocked = false
    this.lockingChainId = null
  }

  public recordDefeat(mimic: SimulatedCombatMimic): void {
    if (!mimic.isRefill) return
    this.refilledDefeatCount += 1
    this.refillOrdinaryIncome += mimicConfigs[mimic.mimicId].baseReward
  }

  public unlockFinishedEffectChain(): void {
    if (!this.refillLocked) return
    const chainStillActive =
      this.lockingChainId !== null &&
      this.input.pendingEvents.some(
        (event) =>
          event.kind !== 'clearConfirmation' &&
          event.chainId === this.lockingChainId,
      )
    if (!chainStillActive) {
      this.refillLocked = false
      this.lockingChainId = null
    }
  }

  public createMetrics(): Pick<
    EffectCardCombatMetrics,
    | 'emptyFieldDurationsMs'
    | 'fullClearCount'
    | 'refillCount'
    | 'refillEffectCardsGenerated'
    | 'refillEquipmentCardsGenerated'
    | 'refillOrdinaryIncome'
    | 'refilledByMimic'
    | 'refilledDefeatCount'
    | 'refilledMimicCount'
    | 'repeatedRefillsWithoutInterventionCount'
    | 'refillEffectiveTargetCountsBefore'
    | 'refillEffectiveTargetCountsAfter'
    | 'refillTargetShortfalls'
    | 'jackpotChaseRefillCount'
    | 'suppressedRefillCount'
  > {
    const refilledByMimic = { normal: 0, rare1: 0, rare2: 0 }
    for (const mimic of this.input.mimics) {
      if (mimic.isRefill) refilledByMimic[mimic.mimicId] += 1
    }
    return {
      emptyFieldDurationsMs: this.emptyFieldDurationsMs,
      refillEffectiveTargetCountsBefore:
        this.refillEffectiveTargetCountsBefore,
      refillEffectiveTargetCountsAfter:
        this.refillEffectiveTargetCountsAfter,
      refillTargetShortfalls: this.refillTargetShortfalls,
      jackpotChaseRefillCount: this.jackpotChaseRefillCount,
      fullClearCount: this.fullClearCount,
      refillCount: this.refillCount,
      refillEffectCardsGenerated: this.refillEffectCardsGenerated,
      refillEquipmentCardsGenerated: this.refillEquipmentCardsGenerated,
      refillOrdinaryIncome: this.refillOrdinaryIncome,
      refilledByMimic,
      refilledDefeatCount: this.refilledDefeatCount,
      refilledMimicCount: this.refilledMimicCount,
      repeatedRefillsWithoutInterventionCount:
        this.repeatedRefillsWithoutInterventionCount,
      suppressedRefillCount: this.suppressedRefillCount,
    }
  }

  private recordGeneratedContent(mimic: BalanceCombatMimic): void {
    for (const id of mimic.effectCardIds) this.refillEffectCardsGenerated[id] += 1
    for (const id of mimic.visibleEquipmentIds) {
      this.refillEquipmentCardsGenerated[id] += 1
    }
    if (mimic.hiddenEquipmentId) {
      this.refillEquipmentCardsGenerated[mimic.hiddenEquipmentId] += 1
    }
  }

  private isJackpotChaseActive(atMs: number): boolean {
    return this.input
      .getActiveMimics(atMs)
      .some(
        (mimic) =>
          mimic.role === 'jackpot' && mimic.jackpotPhase === 'chasing',
      )
  }
}

function emptyEffectCounts(): Record<EffectCardId, number> {
  return { thunder: 0, meteorite: 0, tornado: 0 }
}
