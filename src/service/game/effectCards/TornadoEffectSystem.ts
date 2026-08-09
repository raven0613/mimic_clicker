import { AnimatedSprite, type Container, type Texture } from 'pixi.js'

import { effectCardConfig } from '../../../configs/effectCardConfig'
import type { RandomSource, Vector2 } from '../../../types/game'
import {
  advanceOneShotAnimation,
  getLoopingFrameIndex,
} from '../effects/spriteSheetAnimation'
import type { RuntimeMimicEntity } from '../runtimeTypes'
import { calculateInitialTornadoDamage } from './effectCardRules'
import { toRuntimeEffectAttackTarget } from './runtimeEffectTarget'
import {
  advanceTornadoRunMotion,
  advanceTornadoStraightMotion,
  calculateTornadoDisplaySize,
  clampTornadoSpawnPosition,
  collectTornadoHitTargets,
  createTornadoInitialDirections,
  selectTornadoTurnInterval,
  type TornadoMotionState,
} from './tornadoRules'

type TornadoPhase = 'start' | 'run' | 'end'

interface TornadoTextures {
  tornadoStartFrames: Texture[]
  tornadoRunFrames: Texture[]
  tornadoEndFrames: Texture[]
}

interface ActiveTornado {
  sprite: AnimatedSprite
  phase: TornadoPhase
  phaseElapsedMs: number
  runElapsedMs: number
  motion: TornadoMotionState
  nextDamageAllowedAtMsByTarget: Map<RuntimeMimicEntity, number>
}

export class TornadoEffectSystem {
  private readonly activeTornadoes: ActiveTornado[] = []
  private readonly layer: Container
  private readonly textures: TornadoTextures
  private readonly random: RandomSource
  private readonly getFieldSize: () => { width: number; height: number }
  private readonly getTargets: () => readonly RuntimeMimicEntity[]
  private readonly damageTarget: (
    entity: RuntimeMimicEntity,
    damage: number,
  ) => void

  public constructor(
    layer: Container,
    textures: TornadoTextures,
    random: RandomSource,
    getFieldSize: () => { width: number; height: number },
    getTargets: () => readonly RuntimeMimicEntity[],
    damageTarget: (entity: RuntimeMimicEntity, damage: number) => void,
  ) {
    this.layer = layer
    this.textures = textures
    this.random = random
    this.getFieldSize = getFieldSize
    this.getTargets = getTargets
    this.damageTarget = damageTarget
  }

  public trigger(source: Vector2): void {
    const config = effectCardConfig.tornado
    const directions = createTornadoInitialDirections(
      config.initialTornadoCount,
      this.random,
    )
    const field = this.getFieldSize()
    const spawnPosition = clampTornadoSpawnPosition(source, field)
    for (const direction of directions) {
      this.addTornado(spawnPosition, direction)
    }
  }

  public update(deltaMs: number): void {
    for (const tornado of [...this.activeTornadoes]) {
      this.advanceTornado(tornado, Math.max(0, deltaMs))
    }
  }

  public resetTargetDamageInterval(target: RuntimeMimicEntity): void {
    for (const tornado of this.activeTornadoes) {
      tornado.nextDamageAllowedAtMsByTarget.delete(target)
    }
  }

  public clear(): void {
    for (const tornado of this.activeTornadoes) {
      destroyTornadoSprite(tornado.sprite)
    }
    this.activeTornadoes.length = 0
  }

  public hasActiveEffects(): boolean {
    return this.activeTornadoes.length > 0
  }

  private addTornado(position: Vector2, direction: Vector2): void {
    const displaySize = calculateTornadoDisplaySize()
    const sprite = new AnimatedSprite({
      textures: this.textures.tornadoStartFrames,
      autoUpdate: false,
      loop: false,
      anchor: { x: 0.5, y: 1 },
      eventMode: 'none',
      roundPixels: true,
    })
    sprite.setSize(displaySize.width, displaySize.height)
    sprite.position.set(position.x, position.y)
    sprite.gotoAndStop(0)
    const tornado: ActiveTornado = {
      sprite,
      phase: 'start',
      phaseElapsedMs: 0,
      runElapsedMs: 0,
      motion: {
        position: { ...position },
        direction: { ...direction },
        remainingTurnMs: selectTornadoTurnInterval(this.random),
      },
      nextDamageAllowedAtMsByTarget: new Map(),
    }
    this.activeTornadoes.push(tornado)
    this.layer.addChild(sprite)
  }

  private advanceTornado(tornado: ActiveTornado, deltaMs: number): void {
    let remainingMs = deltaMs
    while (
      remainingMs > 0 &&
      this.activeTornadoes.includes(tornado)
    ) {
      const phaseRemainingMs =
        getPhaseDurationMs(tornado.phase) - tornado.phaseElapsedMs
      const stepMs = Math.min(remainingMs, phaseRemainingMs)
      this.advancePhaseMotion(tornado, stepMs)
      tornado.phaseElapsedMs += stepMs
      if (tornado.phase === 'run') {
        tornado.runElapsedMs += stepMs
        this.damageOverlappingTargets(tornado)
      }
      this.syncVisual(tornado)
      remainingMs -= stepMs
      if (tornado.phaseElapsedMs === getPhaseDurationMs(tornado.phase)) {
        this.completePhase(tornado)
      }
    }
  }

  private advancePhaseMotion(tornado: ActiveTornado, deltaMs: number): void {
    const field = this.getFieldSize()
    tornado.motion =
      tornado.phase === 'run'
        ? advanceTornadoRunMotion(
            tornado.motion,
            deltaMs,
            field,
            this.random,
          )
        : {
            ...advanceTornadoStraightMotion(tornado.motion, deltaMs, field),
            remainingTurnMs: tornado.motion.remainingTurnMs,
          }
  }

  private completePhase(tornado: ActiveTornado): void {
    if (tornado.phase === 'start') {
      tornado.phase = 'run'
      tornado.phaseElapsedMs = 0
      this.setSpriteFrames(tornado, this.textures.tornadoRunFrames, true)
      this.damageOverlappingTargets(tornado)
      return
    }
    if (tornado.phase === 'run') {
      tornado.phase = 'end'
      tornado.phaseElapsedMs = 0
      this.setSpriteFrames(tornado, this.textures.tornadoEndFrames, false)
      return
    }
    this.removeTornado(tornado)
  }

  private setSpriteFrames(
    tornado: ActiveTornado,
    frames: Texture[],
    loop: boolean,
  ): void {
    tornado.sprite.textures = frames
    tornado.sprite.loop = loop
    tornado.sprite.gotoAndStop(0)
  }

  private syncVisual(tornado: ActiveTornado): void {
    tornado.sprite.position.set(
      tornado.motion.position.x,
      tornado.motion.position.y,
    )
    const frames = getPhaseFrames(tornado.phase, this.textures)
    const frameIndex =
      tornado.phase === 'run'
        ? getLoopingFrameIndex(
            tornado.phaseElapsedMs,
            effectCardConfig.tornado.runAnimationCycleDurationMs,
            frames.length,
          )
        : advanceOneShotAnimation(
            0,
            tornado.phaseElapsedMs,
            getPhaseDurationMs(tornado.phase),
            frames.length,
          ).frameIndex
    tornado.sprite.gotoAndStop(frameIndex)
  }

  private damageOverlappingTargets(tornado: ActiveTornado): void {
    const hitTargets = collectTornadoHitTargets(
      this.getTargets().map(toRuntimeEffectAttackTarget),
      tornado.motion.position,
    )
    for (const hit of hitTargets) {
      const nextAllowedAtMs =
        tornado.nextDamageAllowedAtMsByTarget.get(hit.id) ?? 0
      if (tornado.runElapsedMs < nextAllowedAtMs) continue
      tornado.nextDamageAllowedAtMsByTarget.set(
        hit.id,
        tornado.runElapsedMs +
          effectCardConfig.tornado.damageIntervalPerTargetMs,
      )
      this.damageTarget(hit.id, calculateInitialTornadoDamage())
    }
  }

  private removeTornado(tornado: ActiveTornado): void {
    const index = this.activeTornadoes.indexOf(tornado)
    if (index < 0) return
    this.activeTornadoes.splice(index, 1)
    destroyTornadoSprite(tornado.sprite)
  }
}

function getPhaseDurationMs(phase: TornadoPhase): number {
  const config = effectCardConfig.tornado
  if (phase === 'start') return config.startAnimationDurationMs
  if (phase === 'run') return config.runDurationMs
  return config.endAnimationDurationMs
}

function getPhaseFrames(
  phase: TornadoPhase,
  textures: TornadoTextures,
): Texture[] {
  if (phase === 'start') return textures.tornadoStartFrames
  if (phase === 'run') return textures.tornadoRunFrames
  return textures.tornadoEndFrames
}

function destroyTornadoSprite(sprite: AnimatedSprite): void {
  sprite.removeFromParent()
  sprite.destroy({ texture: false, textureSource: false })
}
