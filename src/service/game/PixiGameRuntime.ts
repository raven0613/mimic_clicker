import { Application, Container, type Ticker } from 'pixi.js'

import { combatConfig } from '../../configs/combatConfig'
import { interfaceConfig } from '../../configs/interfaceConfig'
import { jackpotConfig } from '../../configs/jackpotConfig'
import { mimicConfigs } from '../../configs/mimicConfigs'
import { roundConfig } from '../../configs/roundConfig'
import { spawnConfig } from '../../configs/spawnConfig'
import type {
  EquipmentCollectionTargets,
  JackpotOutcome,
  MimicId,
  RandomSource,
  RoundResult,
} from '../../types/game'
import { advanceJackpotLifecycle } from '../combat/combat'
import { calculateJackpotReward } from '../progression/progression'
import { selectWeightedMimicId } from '../spawn/spawn'
import {
  loadRuntimeAssets,
  type LoadedAttachedCardTextures,
} from './assets/runtimeAssets'
import {
  assignJackpotRuntimeAttachedCards,
  updateRuntimeAttachedCardHalos,
} from './attachedCards/runtimeAttachedCards'
import { applyRuntimeMimicDamage } from './damage/runtimeMimicDamage'
import { performRuntimeManualAttack } from './damage/runtimeManualAttack'
import { resolveRuntimeRingStrikes } from './equipment/runtimeRingStrikes'
import { addRuntimeDeathEffect } from './effects/runtimeDeathEffect'
import { revealRuntimeJackpot } from './jackpot/revealRuntimeJackpot'
import { createSpawnedRuntimeMimic } from './runtimeMimicSpawn'
import { moveChasingJackpot, updateRuntimeEntityVisual } from './runtimeMovement'
import { RuntimeEffectSystems } from './RuntimeEffectSystems'
import type { LoadedMimicTextures, RuntimeCallbacks, RuntimeMimicEntity } from './runtimeTypes'

type RuntimeMode = 'idle' | 'active' | 'decorative'

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
  private effectSystems: RuntimeEffectSystems | null = null
  private mode: RuntimeMode = 'idle'
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
  private nextRuntimeEntityId = 1
  private nextRewardEventId = 1

  public constructor(
    host: HTMLElement,
    callbacks: RuntimeCallbacks,
    random: RandomSource = Math.random,
  ) {
    this.host = host
    this.callbacks = callbacks
    this.random = random
  }

  public async initialize(): Promise<void> {
    await this.app.init({
      resizeTo: this.host,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, interfaceConfig.maximumCanvasResolution),
      preference: 'webgl',
      eventFeatures: { move: false, globalMove: false, click: true, wheel: false },
    })
    this.initialized = true
    this.host.appendChild(this.app.canvas)
    this.fieldLayer.eventMode = 'passive'
    this.app.stage.addChild(this.fieldLayer)

    const assets = await loadRuntimeAssets()
    this.textures = assets.mimics
    this.attachedCardTextures = assets.attachedCards
    this.effectSystems = new RuntimeEffectSystems({
      stage: this.app.stage,
      host: this.host,
      assets,
      random: this.random,
      getFieldSize: () => ({
        width: this.app.screen.width,
        height: this.app.screen.height,
      }),
      getTargets: () => this.entities,
      damageTarget: (entity, damage) => this.damageEntity(entity, damage),
      onRewardPresented: (reward) => {
        this.presentedRoundGold += reward
        this.emitHudSnapshot()
      },
    })
    this.app.ticker.add(this.update)
  }

  public startRound(mimicPool: MimicId[]): void {
    if (!this.textures) {
      throw new Error('Cannot start a round before PixiJS assets are loaded')
    }
    this.clearScene()
    this.mode = 'active'
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
    this.hudSnapshotElapsedMs = interfaceConfig.hudSnapshotIntervalMs
    this.emitHudSnapshot()
  }

  public setDecorativePool(mimicPool: MimicId[]): void {
    this.mimicPool = [...mimicPool]
  }

  public resetToIdle(): void {
    this.mode = 'idle'
    this.clearScene()
  }

  public setRewardCollectionTarget(target: { x: number; y: number } | null): void {
    this.effectSystems?.setRewardCollectionTarget(target, {
      x: this.app.screen.width,
      y: this.app.screen.height,
    })
  }

  public setEquipmentCollectionTargets(
    targets: EquipmentCollectionTargets,
  ): void {
    this.effectSystems?.setEquipmentCollectionTargets(targets, {
      x: this.app.screen.width,
      y: this.app.screen.height,
    })
  }

  public destroy(): void {
    if (!this.initialized) return
    this.app.ticker.remove(this.update)
    this.clearScene()
    this.effectSystems?.destroy()
    this.app.destroy({ removeView: true }, { children: true })
    this.effectSystems = null
    this.attachedCardTextures = null
    this.initialized = false
  }

  private readonly update = (ticker: Ticker): void => {
    const deltaMs = Math.min(ticker.deltaMS, combatConfig.maximumFrameDeltaMs)
    this.effectSystems?.updatePersistent(deltaMs)

    if (this.mode === 'idle') {
      return
    }

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
        damageTarget: (target, damage) => this.damageEntity(target, damage),
        addHitEffect: (position, tintColor) => this.effectSystems?.addManualHit(position, tintColor),
      })
    }
    if (!this.roundEnding) {
      this.mainRemainingMs = Math.max(0, this.mainRemainingMs - deltaMs)
      this.roundElapsedMs += deltaMs
      this.nextRegularSpawnMs -= deltaMs
      this.trySpawnJackpotDisguise()
      this.trySpawnRegular(false)

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
    if (!this.textures || !this.attachedCardTextures || this.app.screen.width <= 0) {
      return false
    }
    const entity = createSpawnedRuntimeMimic({
      runtimeId: this.nextRuntimeEntityId,
      mimicId,
      role,
      decorative,
      fieldSize: {
        x: this.app.screen.width,
        y: this.app.screen.height,
      },
      entities: this.entities,
      mimicTextures: this.textures,
      attachedCardTextures: this.attachedCardTextures,
      random: this.random,
      onAttack: (attackedEntity, position) =>
        this.attackEntity(attackedEntity, position),
    })
    if (!entity) return false
    this.nextRuntimeEntityId += 1

    this.entities.push(entity)
    this.fieldLayer.addChild(entity.container)
    return true
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
    const lifecycle = entity.jackpotLifecycle
    if (!lifecycle) return

    if (lifecycle.phase === 'chasing') {
      const previousPhase = lifecycle.phase
      entity.jackpotLifecycle = advanceJackpotLifecycle(
        lifecycle,
        deltaMs,
        entity.logicalX,
      )
      if (entity.jackpotLifecycle.phase !== previousPhase) {
        this.resolveJackpot('escaped')
      } else {
        moveChasingJackpot(
          entity,
          deltaMs,
          this.app.screen.width,
          this.app.screen.height,
        )
      }
    } else if (lifecycle.phase === 'stunned') {
      entity.jackpotLifecycle = advanceJackpotLifecycle(
        lifecycle,
        deltaMs,
        entity.logicalX,
      )
    } else if (lifecycle.phase === 'escaping') {
      entity.logicalX = lifecycle.lockedEscapeX ?? entity.logicalX
      entity.logicalY +=
        jackpotConfig.escapeSpeedPixelsPerSecond * (deltaMs / 1_000)
      if (entity.logicalY - spawnConfig.cardHeightPixels / 2 > this.app.screen.height) {
        this.removeEntity(entity)
        if (this.roundEnding) this.finishRound()
      }
    }
  }

  private attackEntity(entity: RuntimeMimicEntity, position: { x: number; y: number }): void {
    performRuntimeManualAttack({
      entity,
      position,
      attackAtMs: this.roundElapsedMs,
      equipment: this.effectSystems?.equipment ?? null,
      damageTarget: (target, damage) => this.damageEntity(target, damage),
      addHitEffect: (hitPosition) =>
        this.effectSystems?.addManualHit(hitPosition),
    })
  }

  private damageEntity(entity: RuntimeMimicEntity, damage: number): boolean {
    if (this.mode !== 'active' || this.roundEnding) return false
    if (!this.entities.includes(entity)) return false
    if (entity.health === null || entity.maximumHealth === null) return false
    if (entity.jackpotLifecycle?.phase !== 'chasing' && entity.role === 'jackpot') {
      return false
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
    } else {
      if (rewardEventId === null) {
        throw new Error('Mimic reward event is missing an id')
      }
      const reward = mimicConfigs[entity.mimicId].baseReward
      this.roundGold += reward
      this.defeatedMimics += 1
      addRuntimeDeathEffect(this.effectSystems, entity, reward, rewardEventId, this.app.screen.height)
      this.removeEntity(entity)
    }
    this.emitHudSnapshot()
    return true
  }

  private revealJackpot(entity: RuntimeMimicEntity): void {
    if (!this.textures) return
    revealRuntimeJackpot(entity, this.textures.jackpot, this.random)
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
    const result: RoundResult = {
      earnedGold: this.roundGold,
      defeatedMimics: this.defeatedMimics,
      jackpotOutcome: this.jackpotOutcome ?? 'notRevealed',
    }
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
    const index = this.entities.indexOf(entity)
    if (index >= 0) this.entities.splice(index, 1)
    entity.container.destroy({ children: true })
  }

  private clearScene(): void {
    this.effectSystems?.clear()
    for (const entity of [...this.entities]) this.removeEntity(entity)
  }
}
