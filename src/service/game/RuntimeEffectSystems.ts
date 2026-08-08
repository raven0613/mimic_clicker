import type { Container } from 'pixi.js'

import type { RandomSource, Vector2 } from '../../types/game'
import type { LoadedRuntimeAssets } from './assets/runtimeAssets'
import {
  DeathEffectSystem,
  type AddDeathEffectInput,
} from './effects/DeathEffectSystem'
import { HitEffectSystem } from './effects/HitEffectSystem'
import { EffectCardSystem } from './effectCards/EffectCardSystem'
import type { RuntimeMimicEntity } from './runtimeTypes'

interface RuntimeEffectSystemsInput {
  stage: Container
  host: HTMLElement
  assets: LoadedRuntimeAssets
  random: RandomSource
  getFieldSize: () => { width: number; height: number }
  getTargets: () => readonly RuntimeMimicEntity[]
  damageTarget: (entity: RuntimeMimicEntity, damage: number) => void
  onRewardPresented: (reward: number) => void
}

export class RuntimeEffectSystems {
  public readonly effectCards: EffectCardSystem
  private readonly death: DeathEffectSystem
  private readonly hit: HitEffectSystem

  public constructor(input: RuntimeEffectSystemsInput) {
    this.death = new DeathEffectSystem(
      input.stage,
      input.host,
      input.assets.coins,
      input.random,
      input.onRewardPresented,
    )
    this.effectCards = new EffectCardSystem(
      input.stage,
      input.assets.effectCards,
      input.random,
      input.getFieldSize,
      input.getTargets,
      input.damageTarget,
    )
    this.hit = new HitEffectSystem(input.stage, input.assets.combatEffects)
  }

  public setRewardCollectionTarget(
    target: Vector2 | null,
    fieldSize: Vector2,
  ): void {
    this.death.setRewardCollectionTarget(target, fieldSize)
  }

  public addDeath(input: AddDeathEffectInput): void {
    this.death.add(input)
  }

  public addManualHit(position: Vector2): void {
    this.hit.add(position)
  }

  public updatePersistent(deltaMs: number): void {
    this.death.update(deltaMs)
    this.hit.update(deltaMs)
  }

  public updateEffectCards(deltaMs: number): void {
    this.effectCards.update(deltaMs)
  }

  public cancelUnresolvedEffectCards(): void {
    this.effectCards.cancelUnresolved()
  }

  public clear(): void {
    this.effectCards.clear()
    this.hit.clear()
    this.death.clear()
  }

  public destroy(): void {
    this.effectCards.destroy()
    this.hit.destroy()
    this.death.destroy()
  }
}
