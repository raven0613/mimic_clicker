import { AnimatedSprite, type Container, type Texture } from 'pixi.js'

import { effectCardConfig } from '../../../configs/effectCardConfig'
import type { RandomSource, Vector2 } from '../../../types/game'
import { OneShotSpriteEffectSystem } from '../effects/OneShotSpriteEffectSystem'
import { getLoopingFrameIndex } from '../effects/spriteSheetAnimation'
import type { RuntimeMimicEntity } from '../runtimeTypes'
import { calculateInitialMeteoriteDamage } from './effectCardRules'
import {
  advanceMeteoriteFlight,
  calculateExplosionDisplaySize,
  calculateMeteoriteDisplaySize,
  collectMeteoriteHitTargets,
  createMeteoriteTrajectory,
  selectFirstMeteoriteLandingPoint,
  selectMeteoriteLandingPoint,
  selectSpacedMeteoriteLandingPoint,
  type MeteoriteTrajectory,
} from './meteoriteRules'
import { toRuntimeEffectAttackTarget } from './runtimeEffectTarget'

interface MeteoriteSequence {
  firstTargetWaitRemainingMs: number
  nextLaunchRemainingMs: number
  previousLandings: Vector2[]
  remainingMeteoriteCount: number
}

interface ActiveMeteorite {
  sprite: AnimatedSprite
  trajectory: MeteoriteTrajectory
  remainingDistance: number
  animationElapsedMs: number
}

interface MeteoriteTextures {
  meteoriteFrames: Texture[]
  explosionFrames: Texture[]
}

export class MeteoriteEffectSystem {
  private readonly explosionPlayer: OneShotSpriteEffectSystem
  private readonly sequences: MeteoriteSequence[] = []
  private readonly activeMeteorites: ActiveMeteorite[] = []
  private readonly layer: Container
  private readonly textures: MeteoriteTextures
  private readonly random: RandomSource
  private readonly getFieldSize: () => { width: number; height: number }
  private readonly getTargets: () => readonly RuntimeMimicEntity[]
  private readonly damageTarget: (
    entity: RuntimeMimicEntity,
    damage: number,
  ) => void

  public constructor(
    layer: Container,
    textures: MeteoriteTextures,
    random: RandomSource,
    getFieldSize: () => { width: number; height: number },
    getTargets: () => readonly RuntimeMimicEntity[],
    damageTarget: (entity: RuntimeMimicEntity, damage: number) => void,
  ) {
    this.explosionPlayer = new OneShotSpriteEffectSystem(layer)
    this.layer = layer
    this.textures = textures
    this.random = random
    this.getFieldSize = getFieldSize
    this.getTargets = getTargets
    this.damageTarget = damageTarget
  }

  public trigger(): void {
    const sequence: MeteoriteSequence = {
      firstTargetWaitRemainingMs:
        effectCardConfig.meteorite.maximumFirstTargetWaitMs,
      nextLaunchRemainingMs: 0,
      previousLandings: [],
      remainingMeteoriteCount:
        effectCardConfig.meteorite.initialMeteoriteCount,
    }
    this.sequences.push(sequence)
    this.advanceSequence(sequence, 0)
  }

  public update(deltaMs: number): void {
    this.explosionPlayer.update(deltaMs)
    this.updateActiveMeteorites(deltaMs)
    this.updateScheduledMeteorites(deltaMs)
  }

  public cancelUnresolved(): void {
    this.sequences.length = 0
    for (const meteorite of this.activeMeteorites) {
      destroyMeteoriteSprite(meteorite.sprite)
    }
    this.activeMeteorites.length = 0
  }

  public clear(): void {
    this.cancelUnresolved()
    this.explosionPlayer.clear()
  }

  public hasActiveEffects(): boolean {
    return (
      this.sequences.length > 0 ||
      this.activeMeteorites.length > 0 ||
      this.explosionPlayer.hasActiveEffects()
    )
  }

  private updateScheduledMeteorites(deltaMs: number): void {
    for (const sequence of [...this.sequences]) {
      this.advanceSequence(sequence, Math.max(0, deltaMs))
      if (sequence.remainingMeteoriteCount > 0) continue
      const index = this.sequences.indexOf(sequence)
      if (index >= 0) this.sequences.splice(index, 1)
    }
  }

  private advanceSequence(
    sequence: MeteoriteSequence,
    deltaMs: number,
  ): void {
    let availableMs = deltaMs
    while (sequence.remainingMeteoriteCount > 0) {
      if (sequence.previousLandings.length === 0) {
        const targets = this.getTargets().map(toRuntimeEffectAttackTarget)
        const targetedLanding = selectFirstMeteoriteLandingPoint(
          this.getFieldSize(),
          targets,
          this.random,
        )
        if (targetedLanding) {
          this.launchFromSequence(sequence, targetedLanding, 0)
          return
        }
        if (availableMs < sequence.firstTargetWaitRemainingMs) {
          sequence.firstTargetWaitRemainingMs -= availableMs
          return
        }
        availableMs -= sequence.firstTargetWaitRemainingMs
        sequence.firstTargetWaitRemainingMs = 0
        this.launchFromSequence(
          sequence,
          selectMeteoriteLandingPoint(this.getFieldSize(), this.random),
          availableMs,
        )
        continue
      }

      if (availableMs < sequence.nextLaunchRemainingMs) {
        sequence.nextLaunchRemainingMs -= availableMs
        return
      }
      availableMs -= sequence.nextLaunchRemainingMs
      this.launchFromSequence(
        sequence,
        selectSpacedMeteoriteLandingPoint(
          this.getFieldSize(),
          sequence.previousLandings,
          this.random,
        ),
        availableMs,
      )
    }
  }

  private launchFromSequence(
    sequence: MeteoriteSequence,
    landing: Vector2,
    flightAdvanceMs: number,
  ): void {
    sequence.previousLandings.push(landing)
    sequence.remainingMeteoriteCount -= 1
    const meteorite = this.launchMeteorite(landing)
    this.advanceMeteorite(meteorite, flightAdvanceMs)
    if (sequence.remainingMeteoriteCount > 0) {
      const config = effectCardConfig.meteorite
      sequence.nextLaunchRemainingMs =
        config.minimumLaunchIntervalMs +
        Math.min(1, Math.max(0, this.random())) *
          (config.maximumLaunchIntervalMs - config.minimumLaunchIntervalMs)
    }
  }

  private updateActiveMeteorites(deltaMs: number): void {
    for (const meteorite of [...this.activeMeteorites]) {
      this.advanceMeteorite(meteorite, deltaMs)
    }
  }

  private launchMeteorite(landing: Vector2): ActiveMeteorite {
    const field = this.getFieldSize()
    const trajectory = createMeteoriteTrajectory(field, landing)
    const config = effectCardConfig.meteorite
    const displaySize = calculateMeteoriteDisplaySize()
    const sprite = new AnimatedSprite({
      textures: this.textures.meteoriteFrames,
      autoUpdate: false,
      loop: true,
      anchor: { x: 0.5, y: 1 },
      eventMode: 'none',
      roundPixels: true,
    })
    sprite.setSize(displaySize.width, displaySize.height)
    sprite.position.set(trajectory.start.x, trajectory.start.y)
    sprite.rotation = config.rotationRadians
    sprite.gotoAndStop(0)
    const meteorite = {
      sprite,
      trajectory,
      remainingDistance: trajectory.distance,
      animationElapsedMs: 0,
    }
    this.activeMeteorites.push(meteorite)
    this.layer.addChild(sprite)
    return meteorite
  }

  private advanceMeteorite(
    meteorite: ActiveMeteorite,
    deltaMs: number,
  ): void {
    if (!this.activeMeteorites.includes(meteorite)) return
    const progress = advanceMeteoriteFlight(
      {
        position: { x: meteorite.sprite.x, y: meteorite.sprite.y },
        remainingDistance: meteorite.remainingDistance,
      },
      deltaMs,
      meteorite.trajectory.direction,
    )
    meteorite.sprite.position.set(progress.position.x, progress.position.y)
    meteorite.remainingDistance = progress.remainingDistance
    meteorite.animationElapsedMs += Math.max(0, deltaMs)
    meteorite.sprite.gotoAndStop(
      getLoopingFrameIndex(
        meteorite.animationElapsedMs,
        effectCardConfig.meteorite.animationCycleDurationMs,
        this.textures.meteoriteFrames.length,
      ),
    )
    if (progress.arrived) this.landMeteorite(meteorite)
  }

  private landMeteorite(meteorite: ActiveMeteorite): void {
    const index = this.activeMeteorites.indexOf(meteorite)
    if (index < 0) return
    this.activeMeteorites.splice(index, 1)
    destroyMeteoriteSprite(meteorite.sprite)
    this.addExplosion(meteorite.trajectory.landing)
    const damage = calculateInitialMeteoriteDamage()
    const targets = this.getTargets().map(toRuntimeEffectAttackTarget)
    const hitTargets = collectMeteoriteHitTargets(
      targets,
      meteorite.trajectory.landing,
    )
    for (const hit of hitTargets) {
      this.damageTarget(hit.id, damage)
    }
  }

  private addExplosion(position: Vector2): void {
    const config = effectCardConfig.meteorite
    const displaySize = calculateExplosionDisplaySize()
    this.explosionPlayer.add({
      textures: this.textures.explosionFrames,
      durationMs: config.explosionAnimationDurationMs,
      position,
      width: displaySize.width,
      height: displaySize.height,
      anchor: { x: 0.5, y: 1 },
    })
  }
}

function destroyMeteoriteSprite(sprite: AnimatedSprite): void {
  sprite.removeFromParent()
  sprite.destroy({ texture: false, textureSource: false })
}
