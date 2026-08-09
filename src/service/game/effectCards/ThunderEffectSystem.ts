import type { Container, Texture } from 'pixi.js'

import { effectCardConfig } from '../../../configs/effectCardConfig'
import type { RandomSource, Vector2 } from '../../../types/game'
import { OneShotSpriteEffectSystem } from '../effects/OneShotSpriteEffectSystem'
import type { RuntimeMimicEntity } from '../runtimeTypes'
import { calculateInitialThunderDamage } from './effectCardRules'
import { toRuntimeEffectAttackTarget } from './runtimeEffectTarget'
import {
  collectThunderHitTargets,
  selectThunderTarget,
} from './thunderTargeting'

export class ThunderEffectSystem {
  private readonly player: OneShotSpriteEffectSystem
  private readonly frames: Texture[]
  private readonly random: RandomSource
  private readonly getTargets: () => readonly RuntimeMimicEntity[]
  private readonly damageTarget: (
    entity: RuntimeMimicEntity,
    damage: number,
  ) => void

  public constructor(
    layer: Container,
    frames: Texture[],
    random: RandomSource,
    getTargets: () => readonly RuntimeMimicEntity[],
    damageTarget: (entity: RuntimeMimicEntity, damage: number) => void,
  ) {
    this.player = new OneShotSpriteEffectSystem(layer)
    this.frames = frames
    this.random = random
    this.getTargets = getTargets
    this.damageTarget = damageTarget
  }

  public trigger(fallbackPosition: Vector2): void {
    const selectedEntities = new Set<RuntimeMimicEntity>()
    for (
      let strikeIndex = 0;
      strikeIndex < effectCardConfig.thunder.initialStrikeCount;
      strikeIndex += 1
    ) {
      const targets = this.getTargets().map(toRuntimeEffectAttackTarget)
      const selected = selectThunderTarget(targets, selectedEntities, this.random)
      const position = selected
        ? { x: selected.logicalX, y: selected.logicalY }
        : fallbackPosition
      this.addAnimation(position)
      if (!selected) continue

      selectedEntities.add(selected.id)
      const damage = calculateInitialThunderDamage()
      for (const hit of collectThunderHitTargets(targets, selected)) {
        this.damageTarget(hit.id, damage)
      }
    }
  }

  public update(deltaMs: number): void {
    this.player.update(deltaMs)
  }

  public clear(): void {
    this.player.clear()
  }

  public hasActiveEffects(): boolean {
    return this.player.hasActiveEffects()
  }

  private addAnimation(position: Vector2): void {
    const config = effectCardConfig.thunder
    this.player.add({
      textures: this.frames,
      durationMs: config.animationDurationMs,
      position,
      width: config.spriteSheet.frameWidthPixels,
      height: config.spriteSheet.frameHeightPixels,
      anchor: { x: 0.5, y: 1 },
    })
  }
}
