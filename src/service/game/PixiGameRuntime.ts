import {
  Application,
  Assets,
  Container,
  type Texture,
  type Ticker,
} from 'pixi.js'

import jackpotImageUrl from '../../assets/mimic/jackpot.png'
import normalImageUrl from '../../assets/mimic/normal.png'
import rare1ImageUrl from '../../assets/mimic/rare1.png'
import rare2ImageUrl from '../../assets/mimic/rare2.png'
import { animationConfig } from '../../configs/animationConfig'
import { combatConfig } from '../../configs/combatConfig'
import { interfaceConfig } from '../../configs/interfaceConfig'
import { jackpotConfig } from '../../configs/jackpotConfig'
import { mimicConfigs } from '../../configs/mimicConfigs'
import { roundConfig } from '../../configs/roundConfig'
import { spawnConfig } from '../../configs/spawnConfig'
import type { JackpotOutcome, MimicId, RandomSource, RoundResult } from '../../types/game'
import { applyDamage, advanceJackpotLifecycle } from '../combat/combat'
import { calculateJackpotReward } from '../progression/progression'
import { selectSpawnPosition, selectWeightedMimicId } from '../spawn/spawn'
import { DeathEffectSystem } from './effects/DeathEffectSystem'
import { loadCoinRewardTextures } from './reward/coinRewardTextures'
import { createRuntimeMimicEntity } from './runtimeEntityFactory'
import { moveChasingJackpot, updateRuntimeEntityVisual } from './runtimeMovement'
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
  private deathEffectSystem: DeathEffectSystem | null = null
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

    const [normal, rare1, rare2, jackpot, coinTextures] = await Promise.all([
      Assets.load<Texture>(normalImageUrl),
      Assets.load<Texture>(rare1ImageUrl),
      Assets.load<Texture>(rare2ImageUrl),
      Assets.load<Texture>(jackpotImageUrl),
      loadCoinRewardTextures(),
    ])
    this.textures = { normal, rare1, rare2, jackpot }
    this.deathEffectSystem = new DeathEffectSystem(
      this.app.stage,
      this.host,
      coinTextures,
      this.random,
      (reward) => {
        this.presentedRoundGold += reward
        this.emitHudSnapshot()
      },
    )
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
    this.deathEffectSystem?.setRewardCollectionTarget(target, {
      x: this.app.screen.width,
      y: this.app.screen.height,
    })
  }

  public destroy(): void {
    if (!this.initialized) return
    this.app.ticker.remove(this.update)
    this.clearScene()
    this.deathEffectSystem?.destroy()
    this.app.destroy({ removeView: true }, { children: true })
    this.deathEffectSystem = null
    this.initialized = false
  }

  private readonly update = (ticker: Ticker): void => {
    const deltaMs = Math.min(ticker.deltaMS, combatConfig.maximumFrameDeltaMs)
    this.deathEffectSystem?.update(deltaMs)

    if (this.mode === 'idle') {
      return
    }

    if (this.mode === 'active') {
      this.updateActiveRound(deltaMs)
    } else {
      this.updateDecorativeMode(deltaMs)
    }
    this.updateEntities(deltaMs)
  }

  private updateActiveRound(deltaMs: number): void {
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
    if (!this.textures || this.app.screen.width <= 0) {
      return false
    }
    const cardWidth = spawnConfig.cardWidthPixels
    const cardHeight = spawnConfig.cardHeightPixels
    const spawnY = -cardHeight + spawnConfig.spawnYInsetPixels
    const occupiedBounds = this.entities
      .filter(
        (entity) =>
          Math.abs(entity.logicalY - spawnY) <=
          spawnConfig.placementCheckVerticalRangePixels,
      )
      .map((entity) => ({
        x: entity.logicalX - cardWidth / 2,
        y: entity.logicalY - cardHeight / 2,
        width: cardWidth,
        height: cardHeight,
      }))
    const position = selectSpawnPosition(
      {
        fieldWidth: this.app.screen.width,
        cardWidth,
        cardHeight,
        spawnY,
        occupiedBounds,
      },
      this.random,
    )
    if (!position) {
      return false
    }

    const centerX = position.x + cardWidth / 2
    const centerY = position.y + cardHeight / 2
    const entity = createRuntimeMimicEntity({
      mimicId,
      role,
      decorative,
      centerX,
      centerY,
      fieldHeight: this.app.screen.height,
      textures: this.textures,
      onAttack: (attackedEntity) => this.attackEntity(attackedEntity),
    })

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

  private attackEntity(entity: RuntimeMimicEntity): void {
    if (this.mode !== 'active' || this.roundEnding || entity.health === null) {
      return
    }
    if (entity.jackpotLifecycle?.phase !== 'chasing' && entity.role === 'jackpot') {
      return
    }

    const damageResult = applyDamage(
      entity.health,
      combatConfig.initialWeaponDamage,
    )
    entity.health = damageResult.remainingHealth
    entity.hitAnimationRemainingMs = animationConfig.hit.durationMs
    if (!damageResult.isDefeated) return

    if (entity.role === 'jackpotDisguise') {
      this.revealJackpot(entity)
    } else if (entity.role === 'jackpot') {
      const reward = calculateJackpotReward(this.mimicPool)
      this.roundGold += reward
      this.defeatedMimics += 1
      this.addDeathEffects(entity, reward)
      this.removeEntity(entity)
      this.resolveJackpot('defeated')
    } else {
      const reward = mimicConfigs[entity.mimicId].baseReward
      this.roundGold += reward
      this.defeatedMimics += 1
      this.addDeathEffects(entity, reward)
      this.removeEntity(entity)
    }
    this.emitHudSnapshot()
  }

  private revealJackpot(entity: RuntimeMimicEntity): void {
    if (!this.textures) return
    entity.role = 'jackpot'
    entity.sprite.texture = this.textures.jackpot
    entity.flashSprite.texture = this.textures.jackpot
    entity.health = jackpotConfig.maximumHealth
    entity.container.zIndex = 100
    const directionRange =
      jackpotConfig.initialDirectionMaximumRadians -
      jackpotConfig.initialDirectionMinimumRadians
    const angle = jackpotConfig.initialDirectionMinimumRadians + this.random() * directionRange
    const horizontalDirection = this.random() < 0.5 ? -1 : 1
    entity.jackpotVelocity = {
      x:
        Math.cos(angle) *
        jackpotConfig.chaseSpeedPixelsPerSecond *
        horizontalDirection,
      y: Math.sin(angle) * jackpotConfig.chaseSpeedPixelsPerSecond,
    }
    entity.jackpotLifecycle = {
      phase: 'chasing',
      remainingChaseMs: jackpotConfig.chaseDurationMs,
      phaseElapsedMs: 0,
      lockedEscapeX: null,
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

  private addDeathEffects(entity: RuntimeMimicEntity, reward: number): void {
    this.deathEffectSystem?.add({
      texture: entity.sprite.texture,
      x: entity.logicalX,
      y: entity.logicalY,
      reward,
      fieldHeight: this.app.screen.height,
      width: spawnConfig.cardWidthPixels,
      height: spawnConfig.cardHeightPixels,
    })
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
    for (const entity of [...this.entities]) this.removeEntity(entity)
    this.deathEffectSystem?.clear()
  }
}
