import type { Container } from 'pixi.js'

import type {
  EquipmentCollectionTargets,
  RandomSource,
  Vector2,
} from '../../types/game'
import { releaseRuntimeAttachedCards } from './attachedCards/runtimeAttachedCards'
import type { LoadedRuntimeAssets } from './assets/runtimeAssets'
import {
  DeathEffectSystem,
  type AddDeathEffectInput,
} from './effects/DeathEffectSystem'
import { HitEffectSystem } from './effects/HitEffectSystem'
import { EffectCardSystem } from './effectCards/EffectCardSystem'
import { EquipmentRewardSystem } from './equipment/EquipmentRewardSystem'
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
  public readonly equipment: EquipmentRewardSystem
  private readonly effectCards: EffectCardSystem
  private readonly death: DeathEffectSystem
  private readonly hit: HitEffectSystem
  private readonly getFieldSize: RuntimeEffectSystemsInput['getFieldSize']

  public constructor(input: RuntimeEffectSystemsInput) {
    this.getFieldSize = input.getFieldSize
    this.equipment = new EquipmentRewardSystem(
      input.stage,
      input.host,
      input.assets.attachedCards,
      input.random,
    )
    this.death = new DeathEffectSystem(
      input.stage,
      input.host,
      input.assets.coins,
      input.random,
      (reward) => {
        input.onRewardPresented(reward)
      },
      (rewardEventId) =>
        this.equipment.notifyCoinCollectionCompleted(rewardEventId),
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

  public setEquipmentCollectionTargets(
    targets: EquipmentCollectionTargets,
    fieldSize: Vector2,
  ): void {
    this.equipment.setCollectionTargetsFromViewport(targets, fieldSize)
  }

  public resolveAttachedCards(
    entity: RuntimeMimicEntity,
    rewardEventId: number | null,
  ): void {
    const released = releaseRuntimeAttachedCards(entity)
    this.effectCards.activateAll(
      released.effectCards,
      entity.logicalX,
      entity.logicalY,
    )
    this.equipment.resolveDrops({
      visibleCards: released.equipmentCards,
      hiddenEquipmentId: released.hiddenEquipmentId,
      source: { x: entity.logicalX, y: entity.logicalY },
      fieldHeight: this.getFieldSize().height,
      rewardEventId,
    })
    released.fan?.container.removeFromParent()
    released.fan?.container.destroy({ children: true })
  }

  public addDeath(input: AddDeathEffectInput): void {
    this.death.add(input)
  }

  public addManualHit(position: Vector2, tintColor?: string): void {
    this.hit.add(position, tintColor)
  }

  public updatePersistent(deltaMs: number): void {
    this.death.update(deltaMs)
    this.hit.update(deltaMs)
    this.equipment.update(deltaMs)
  }

  public updateEffectCards(deltaMs: number): void {
    this.effectCards.update(deltaMs)
  }

  public cancelUnresolvedEffectCards(): void {
    this.effectCards.cancelUnresolved()
  }

  public clear(): void {
    this.equipment.clear()
    this.effectCards.clear()
    this.hit.clear()
    this.death.clear()
  }

  public destroy(): void {
    this.equipment.destroy()
    this.effectCards.destroy()
    this.hit.destroy()
    this.death.destroy()
  }
}
