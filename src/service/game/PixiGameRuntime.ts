import { Application, Container, type Ticker } from 'pixi.js'
import { combatConfig } from '../../configs/combatConfig'
import { interfaceConfig } from '../../configs/interfaceConfig'
import { mimicConfigs } from '../../configs/mimicConfigs'
import { roundConfig } from '../../configs/roundConfig'
import { spawnConfig } from '../../configs/spawnConfig'
import type { EquipmentCollectionTargets, JackpotOutcome, MimicId, RandomSource, RoundProgressionSnapshot } from '../../types/game'
import { calculateJackpotReward } from '../progression/progression'
import { calculateEquipmentSale } from '../settlement/equipmentSale'
import { createRoundResult } from '../settlement/roundSettlement'
import { selectWeightedMimicId } from '../spawn/spawn'
import { loadRuntimeAssets, type LoadedAttachedCardTextures } from './assets/runtimeAssets'
import { assignJackpotRuntimeAttachedCards, updateRuntimeAttachedCardHalos } from './attachedCards/runtimeAttachedCards'
import { applyRuntimeMimicDamage } from './damage/runtimeMimicDamage'
import { RuntimeWeaponAttackSystem } from './damage/RuntimeWeaponAttackSystem'
import { RuntimeClearRefillSystem } from './clearRefill/RuntimeClearRefillSystem'
import { calculateRefillSpawnCount } from './clearRefill/clearRefillTargets'
import { resolveRuntimeRingStrikes } from './equipment/runtimeRingStrikes'
import type { MoveEquipmentCommand } from './equipment/equipmentState'
import { addRuntimeDeathEffect } from './effects/runtimeDeathEffect'
import { revealRuntimeJackpot } from './jackpot/revealRuntimeJackpot'
import { updateRuntimeJackpot } from './jackpot/updateRuntimeJackpot'
import { RuntimeMimicSpawner } from './runtimeMimicSpawn'
import { updateRuntimeEntityVisual } from './runtimeMovement'
import { RuntimeEffectSystems } from './RuntimeEffectSystems'
import type { LoadedMimicTextures, RuntimeCallbacks, RuntimeMimicEntity, RuntimeMoveEquipmentResult } from './runtimeTypes'
import { shouldAdvanceRuntime, type RuntimeUpdateMode } from './runtimeUpdateGate'
type RuntimeDamageSource = 'automatic' | 'manualWeapon'
export class PixiGameRuntime {
  private readonly host: HTMLElement
  private readonly callbacks: RuntimeCallbacks
  private readonly random: RandomSource
  private readonly app = new Application()
  private readonly fieldLayer = new Container({ sortableChildren: true })
  private readonly entities: RuntimeMimicEntity[] = []
  private initialized = false
  private textures: LoadedMimicTextures | null = null
  private attachedCardTextures: LoadedAttachedCardTextures | null = null
  private mimicSpawner: RuntimeMimicSpawner | null = null
  private effectSystems: RuntimeEffectSystems | null = null
  private clearRefillSystem: RuntimeClearRefillSystem | null = null
  private readonly weaponAttacks: RuntimeWeaponAttackSystem
  private mode: RuntimeUpdateMode = 'idle'
  private gameplayPaused = false
  private mimicPool: MimicId[] = ['normal']
  private mainRemainingMs = 0
  private roundElapsedMs = 0
  private nextRegularSpawnMs = 0
  private jackpotReturnAtMs = Number.POSITIVE_INFINITY
  private jackpotMissCount = 0
  private roundGold = 0
  private presentedRoundGold = 0
  private defeatedMimics = 0
  private jackpotOutcome: JackpotOutcome | null = null
  private roundEnding = false
  private hudSnapshotElapsedMs = 0
  private nextRewardEventId = 1
  private roundEquipmentSale = calculateEquipmentSale([])
  public constructor(
    host: HTMLElement,
    callbacks: RuntimeCallbacks,
    random: RandomSource = Math.random,
  ) {
    this.host = host
    this.callbacks = callbacks
    this.random = random
    this.weaponAttacks = new RuntimeWeaponAttackSystem({
      getRoundElapsedMs: () => this.roundElapsedMs,
      getEntities: () => this.entities,
      getEquipment: () => this.effectSystems?.equipment ?? null,
      damageTarget: (entity, damage, source) =>
        this.damageEntity(entity, damage, source === 'manual' ? 'manualWeapon' : 'automatic'),
      addWeaponHitEffect: (position, tintColor) => this.effectSystems?.addWeaponHit(position, tintColor),
    })
  }
  public async initialize(): Promise<void> {
    await this.app.init({
      resizeTo: this.host,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, interfaceConfig.maximumCanvasResolution),
      preference: 'webgl',
      eventFeatures: { move: true, globalMove: false, click: true, wheel: false },
    })
    this.initialized = true
    this.host.appendChild(this.app.canvas)
    this.fieldLayer.eventMode = 'passive'
    this.app.stage.addChild(this.fieldLayer)

    const assets = await loadRuntimeAssets()
    this.textures = assets.mimics
    this.attachedCardTextures = assets.attachedCards
    this.mimicSpawner = new RuntimeMimicSpawner({
      getFieldSize: () => ({ x: this.app.screen.width, y: this.app.screen.height }),
      getEntities: () => this.entities,
      mimicTextures: assets.mimics,
      attachedCardTextures: assets.attachedCards,
      random: this.random,
      onAttack: (entity, position) => this.weaponAttacks.attackManual(entity, position),
      onHoverChanged: (entity, pointerPosition) => this.weaponAttacks.setHoverPosition(entity, pointerPosition),
      onSpawn: (entity) => {
        this.entities.push(entity)
        this.fieldLayer.addChild(entity.container)
      },
    })
    this.effectSystems = new RuntimeEffectSystems({
      stage: this.app.stage,
      host: this.host,
      assets,
      random: this.random,
      getFieldSize: () => ({ width: this.app.screen.width, height: this.app.screen.height }),
      getTargets: () => this.entities,
      damageTarget: (entity, damage) => this.damageEntity(entity, damage, 'automatic'),
      onRewardPresented: (reward) => {
        this.presentedRoundGold += reward
        this.emitHudSnapshot()
      },
      onEquipmentSnapshot: (snapshot) => this.callbacks.onEquipmentSnapshot(snapshot),
    })
    this.clearRefillSystem = new RuntimeClearRefillSystem({
      getEntities: () => this.entities,
      getFieldSize: () => ({ width: this.app.screen.width, height: this.app.screen.height }),
      getRoundState: () => ({
        isRoundActive: this.mode === 'active' && !this.roundEnding,
        remainingRoundMs: this.mainRemainingMs,
      }),
      hasActiveEffectChain: () => this.effectSystems?.hasActiveEffectCardChain() ?? false,
      refill: ({ effectiveTargetCount, isFullClear }) => {
        this.trySpawnJackpotDisguise()
        this.mimicSpawner?.fillField(
          this.mimicPool,
          'clearRefill',
          calculateRefillSpawnCount(effectiveTargetCount),
        )
        if (isFullClear) this.effectSystems?.showClearFeedback()
      },
    })
    this.app.ticker.add(this.update)
  }

  public startRound(
    mimicPool: MimicId[],
    progression: RoundProgressionSnapshot,
  ): void {
    if (!this.textures || !this.attachedCardTextures || !this.mimicSpawner) {
      throw new Error('Cannot start a round before PixiJS assets are loaded')
    }
    this.clearScene()
    this.gameplayPaused = false
    this.weaponAttacks.startRound(progression)
    this.effectSystems?.equipment.startRound(progression.equipmentSlotCount)
    this.mimicPool = [...mimicPool]
    this.mainRemainingMs = roundConfig.durationMs
    this.roundElapsedMs = 0
    this.nextRegularSpawnMs = roundConfig.initialSpawnDelayMs
    this.jackpotReturnAtMs = roundConfig.initialJackpotSpawnDelayMs
    this.jackpotMissCount = 0
    this.roundGold = 0
    this.presentedRoundGold = 0
    this.defeatedMimics = 0
    this.jackpotOutcome = null
    this.roundEnding = false
    this.roundEquipmentSale = calculateEquipmentSale([])
    this.hudSnapshotElapsedMs = interfaceConfig.hudSnapshotIntervalMs
    this.mimicSpawner.fillField(this.mimicPool, 'immediate')
    this.mode = 'active'
    this.emitHudSnapshot()
  }

  public setDecorativePool(mimicPool: MimicId[]): void {
    this.mimicPool = [...mimicPool]
  }
  public resetToIdle(): void {
    this.mode = 'idle'
    this.gameplayPaused = false
    this.clearScene()
  }
  public setGameplayPaused(paused: boolean): void {
    this.gameplayPaused = paused && this.mode === 'active' && !this.roundEnding
  }
  public moveEquipment(command: MoveEquipmentCommand): RuntimeMoveEquipmentResult {
    if (this.mode !== 'active' || this.roundEnding) {
      return { status: 'rejected', reason: 'roundUnavailable' }
    }
    return (
      this.effectSystems?.equipment.moveEquipment(command) ?? {
        status: 'rejected',
        reason: 'roundUnavailable',
      }
    )
  }
  public setRewardCollectionTarget(target: { x: number; y: number } | null): void {
    this.effectSystems?.setRewardCollectionTarget(target, {
      x: this.app.screen.width,
      y: this.app.screen.height,
    })
  }
  public setEquipmentCollectionTargets(targets: EquipmentCollectionTargets): void {
    const fieldSize = { x: this.app.screen.width, y: this.app.screen.height }
    this.effectSystems?.setEquipmentCollectionTargets(targets, fieldSize)
  }
  public destroy(): void {
    if (!this.initialized) return
    this.app.ticker.remove(this.update)
    this.clearScene()
    this.effectSystems?.destroy()
    this.app.destroy({ removeView: true }, { children: true })
    this.effectSystems = null
    this.clearRefillSystem = null
    this.mimicSpawner = null
    this.attachedCardTextures = null
    this.initialized = false
  }

  private readonly update = (ticker: Ticker): void => {
    const deltaMs = Math.min(ticker.deltaMS, combatConfig.maximumFrameDeltaMs)
    if (!shouldAdvanceRuntime(this.mode, this.gameplayPaused)) return
    this.effectSystems?.updatePersistent(deltaMs)

    if (this.mode === 'active') {
      this.updateActiveRound(deltaMs)
      this.effectSystems?.updateEffectCards(deltaMs)
    } else {
      this.updateDecorativeMode(deltaMs)
    }
    this.updateEntities(deltaMs)
  }

  private updateActiveRound(deltaMs: number): void {
    if (!this.roundEnding) {
      resolveRuntimeRingStrikes({
        equipment: this.effectSystems?.equipment ?? null,
        deltaMs: Math.min(deltaMs, this.mainRemainingMs),
        includeEndpoint: deltaMs < this.mainRemainingMs,
        entities: this.entities,
        damageTarget: (target, damage) =>
          this.damageEntity(target, damage, 'automatic'),
        addHitEffect: (position, tintColor) => this.effectSystems?.addWeaponHit(position, tintColor),
      })
    }
    if (!this.roundEnding) {
      const activeDeltaMs = Math.min(deltaMs, this.mainRemainingMs)
      const includeRoundEnd = deltaMs < this.mainRemainingMs
      this.mainRemainingMs = Math.max(0, this.mainRemainingMs - deltaMs)
      this.roundElapsedMs += activeDeltaMs
      this.weaponAttacks.update(activeDeltaMs, includeRoundEnd)
      this.nextRegularSpawnMs -= deltaMs
      this.trySpawnJackpotDisguise()
      this.trySpawnRegular(false)
      this.clearRefillSystem?.update(deltaMs)

      if (this.mainRemainingMs === 0) {
        this.beginRoundEnding()
      }
    }

    this.hudSnapshotElapsedMs += deltaMs
    if (this.hudSnapshotElapsedMs >= interfaceConfig.hudSnapshotIntervalMs) {
      this.hudSnapshotElapsedMs = 0
      this.emitHudSnapshot()
    }
  }

  private updateDecorativeMode(deltaMs: number): void {
    this.nextRegularSpawnMs -= deltaMs
    this.trySpawnRegular(true)
  }

  private trySpawnRegular(decorative: boolean): void {
    if (
      this.nextRegularSpawnMs > 0 ||
      this.entities.length >= spawnConfig.maximumConcurrentMimics
    ) {
      return
    }

    const spawned = this.spawnMimic(
      selectWeightedMimicId(this.mimicPool, this.random),
      'regular',
      decorative,
    )
    this.nextRegularSpawnMs = spawned
      ? decorative
        ? roundConfig.decorativeSpawnIntervalMs
        : roundConfig.regularSpawnIntervalMs
      : spawnConfig.retryDelayMs
  }
  private trySpawnJackpotDisguise(): void {
    if (
      this.jackpotOutcome !== null ||
      this.roundElapsedMs < this.jackpotReturnAtMs ||
      this.findJackpotEntity()
    ) {
      return
    }

    const disguiseId = selectWeightedMimicId(this.mimicPool, this.random)
    if (this.spawnMimic(disguiseId, 'jackpotDisguise', false)) {
      this.jackpotReturnAtMs = Number.POSITIVE_INFINITY
      this.callbacks.onJackpotDisguised()
    } else {
      this.jackpotReturnAtMs = this.roundElapsedMs + spawnConfig.retryDelayMs
    }
  }
  private spawnMimic(
    mimicId: MimicId,
    role: RuntimeMimicEntity['role'],
    decorative: boolean,
  ): boolean {
    if (!this.mimicSpawner || this.app.screen.width <= 0) return false
    return this.mimicSpawner.spawnTopEdge(mimicId, role, decorative)
  }
  private updateEntities(deltaMs: number): void {
    for (const entity of [...this.entities]) {
      if (entity.role === 'jackpot' && entity.jackpotLifecycle) {
        this.updateJackpot(entity, deltaMs)
      } else {
        entity.logicalY +=
          entity.downwardSpeedPixelsPerSecond * (deltaMs / 1_000)
        if (entity.logicalY - spawnConfig.cardHeightPixels / 2 > this.app.screen.height) {
          this.handleFlowExit(entity)
          continue
        }
      }
      updateRuntimeEntityVisual(entity, deltaMs, this.roundElapsedMs)
      updateRuntimeAttachedCardHalos(entity, this.roundElapsedMs)
    }
  }
  private updateJackpot(entity: RuntimeMimicEntity, deltaMs: number): void {
    const result = updateRuntimeJackpot(
      entity,
      deltaMs,
      this.app.screen.width,
      this.app.screen.height,
    )
    if (result === 'escaped') this.resolveJackpot('escaped')
    if (result !== 'flowExited') return
    this.removeEntity(entity)
    if (this.roundEnding) this.finishRound()
  }
  private damageEntity(
    entity: RuntimeMimicEntity,
    damage: number,
    source: RuntimeDamageSource,
  ): boolean {
    if (this.mode !== 'active' || this.roundEnding || this.gameplayPaused) {
      return false
    }
    if (!this.entities.includes(entity)) return false
    if (entity.health === null || entity.maximumHealth === null) return false
    if (
      entity.role === 'jackpot' &&
      entity.jackpotLifecycle?.phase !== 'chasing'
    ) {
      return false
    }

    if (source === 'manualWeapon') {
      this.clearRefillSystem?.notifyValidManualWeaponDamage()
    }

    const isDefeated = applyRuntimeMimicDamage(entity, damage)
    if (!isDefeated) return true

    const rewardEventId =
      entity.role === 'jackpotDisguise' ? null : this.nextRewardEventId++
    this.effectSystems?.resolveAttachedCards(entity, rewardEventId)
    if (entity.role === 'jackpotDisguise') {
      this.revealJackpot(entity)
    } else if (entity.role === 'jackpot') {
      if (rewardEventId === null) {
        throw new Error('Jackpot reward event is missing an id')
      }
      const reward = calculateJackpotReward(this.mimicPool)
      this.roundGold += reward
      this.defeatedMimics += 1
      addRuntimeDeathEffect(this.effectSystems, entity, reward, rewardEventId, this.app.screen.height)
      this.removeEntity(entity)
      this.resolveJackpot('defeated')
      this.clearRefillSystem?.notifyCombatEntityRemovedByDefeat()
    } else {
      if (rewardEventId === null) {
        throw new Error('Mimic reward event is missing an id')
      }
      const reward = mimicConfigs[entity.mimicId].baseReward
      this.roundGold += reward
      this.defeatedMimics += 1
      addRuntimeDeathEffect(this.effectSystems, entity, reward, rewardEventId, this.app.screen.height)
      this.removeEntity(entity)
      this.clearRefillSystem?.notifyCombatEntityRemovedByDefeat()
    }
    this.emitHudSnapshot()
    return true
  }
  private revealJackpot(entity: RuntimeMimicEntity): void {
    if (!this.textures) return
    revealRuntimeJackpot(entity, this.textures.jackpot, this.random)
    this.effectSystems?.resetEffectCardDamageIntervals(entity)
    if (this.attachedCardTextures) {
      assignJackpotRuntimeAttachedCards(
        entity,
        this.attachedCardTextures,
        this.random,
      )
    }
    this.callbacks.onJackpotRevealed()
    this.emitHudSnapshot()
  }
  private handleFlowExit(entity: RuntimeMimicEntity): void {
    if (entity.role === 'jackpotDisguise' && this.mode === 'active') {
      this.jackpotMissCount += 1
      this.jackpotReturnAtMs =
        this.roundElapsedMs +
        roundConfig.jackpotReturnBaseDelayMs +
        this.jackpotMissCount * roundConfig.jackpotReturnAdditionalDelayPerMissMs
      this.callbacks.onJackpotWaitingToReturn()
    }
    this.removeEntity(entity)
  }
  private beginRoundEnding(): void {
    this.roundEnding = true
    this.gameplayPaused = false
    this.roundEquipmentSale = calculateEquipmentSale(
      this.effectSystems?.equipment.getSettlementEquipmentSnapshot() ?? [],
    )
    this.clearRefillSystem?.reset()
    this.effectSystems?.cancelUnresolvedEffectCards()
    this.effectSystems?.equipment.clear()
    this.callbacks.onRoundFinishing()
    for (const entity of this.entities) {
      entity.container.eventMode = 'none'
    }
    const jackpot = this.findJackpotEntity()
    if (jackpot?.role === 'jackpot' && jackpot.jackpotLifecycle) {
      if (jackpot.jackpotLifecycle.phase === 'chasing') {
        jackpot.jackpotLifecycle = {
          phase: 'stunned',
          remainingChaseMs: 0,
          phaseElapsedMs: 0,
          lockedEscapeX: jackpot.logicalX,
        }
        this.resolveJackpot('roundExpiredDuringChase')
      }
      return
    }
    if (jackpot) this.removeEntity(jackpot)
    if (this.jackpotOutcome === null) this.jackpotOutcome = 'notRevealed'
    this.finishRound()
  }
  private resolveJackpot(outcome: JackpotOutcome): void {
    if (this.jackpotOutcome !== null) return
    this.jackpotOutcome = outcome
    this.callbacks.onJackpotResolved()
    this.emitHudSnapshot()
  }
  private finishRound(): void {
    if (this.mode !== 'active') return
    const result = createRoundResult({
      combatGold: this.roundGold,
      equipmentSale: this.roundEquipmentSale,
      defeatedMimics: this.defeatedMimics,
      jackpotOutcome: this.jackpotOutcome ?? 'notRevealed',
    })
    this.clearScene()
    this.mode = 'decorative'
    this.nextRegularSpawnMs = 0
    this.callbacks.onRoundCompleted(result)
  }
  private emitHudSnapshot(): void {
    const jackpot = this.findJackpotEntity()
    this.callbacks.onHudSnapshot({
      mainRemainingMs: this.mainRemainingMs,
      jackpotRemainingMs:
        jackpot?.jackpotLifecycle?.phase === 'chasing'
          ? jackpot.jackpotLifecycle.remainingChaseMs
          : null,
      roundGold: this.roundGold,
      presentedRoundGold: this.presentedRoundGold,
      defeatedMimics: this.defeatedMimics,
      jackpotOutcome: this.jackpotOutcome,
    })
  }
  private findJackpotEntity(): RuntimeMimicEntity | undefined {
    return this.entities.find((entity) => entity.role !== 'regular')
  }
  private removeEntity(entity: RuntimeMimicEntity): void {
    this.weaponAttacks.removeEntity(entity)
    const index = this.entities.indexOf(entity)
    if (index >= 0) this.entities.splice(index, 1)
    entity.container.destroy({ children: true })
  }
  private clearScene(): void {
    this.weaponAttacks.clear()
    this.clearRefillSystem?.reset()
    this.effectSystems?.clear()
    for (const entity of [...this.entities]) this.removeEntity(entity)
  }
}
