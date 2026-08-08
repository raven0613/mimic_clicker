import { AnimatedSprite, Container } from 'pixi.js'

import { effectCardConfig } from '../../../configs/effectCardConfig'
import type { RandomSource } from '../../../types/game'
import { destroySpriteSheetFrameTextures } from '../assets/horizontalSpriteSheetTextures'
import type { LoadedEffectCardTextures } from '../assets/runtimeAssets'
import type { RuntimeMimicEntity } from '../runtimeTypes'
import {
  advanceEffectCardWindup,
  calculateInitialThunderDamage,
} from './effectCardRules'
import type { EffectCardAttachment } from './effectCardVisual'
import {
  collectThunderHitTargets,
  selectThunderTarget,
  type ThunderTarget,
} from './thunderTargeting'

interface PendingThunderCard {
  attachment: EffectCardAttachment
  sourceX: number
  sourceY: number
  startX: number
  startY: number
  startRotation: number
  elapsedMs: number
}

interface ActiveThunderAnimation {
  sprite: AnimatedSprite
  elapsedMs: number
}

interface RuntimeThunderTarget extends ThunderTarget {
  id: RuntimeMimicEntity
}

export class EffectCardSystem {
  private readonly layer = new Container({ eventMode: 'none' })
  private readonly pendingCards: PendingThunderCard[] = []
  private readonly activeThunderAnimations: ActiveThunderAnimation[] = []
  private readonly textures: LoadedEffectCardTextures
  private readonly random: RandomSource
  private readonly getTargets: () => readonly RuntimeMimicEntity[]
  private readonly damageTarget: (
    entity: RuntimeMimicEntity,
    damage: number,
  ) => void

  public constructor(
    stage: Container,
    textures: LoadedEffectCardTextures,
    random: RandomSource,
    getTargets: () => readonly RuntimeMimicEntity[],
    damageTarget: (entity: RuntimeMimicEntity, damage: number) => void,
  ) {
    this.textures = textures
    this.random = random
    this.getTargets = getTargets
    this.damageTarget = damageTarget
    stage.addChild(this.layer)
  }

  public activateAll(
    attachments: readonly EffectCardAttachment[],
    sourceX: number,
    sourceY: number,
  ): void {
    for (const attachment of attachments) {
      attachment.halo.removeFromParent()
      attachment.halo.destroy({ context: false })
      this.layer.reparentChild(attachment.container)
      this.pendingCards.push({
        attachment,
        sourceX,
        sourceY,
        startX: attachment.container.x,
        startY: attachment.container.y,
        startRotation: attachment.container.rotation,
        elapsedMs: 0,
      })
    }
  }

  public update(deltaMs: number): void {
    this.updateThunderAnimations(deltaMs)
    const readyCards: PendingThunderCard[] = []
    for (let index = this.pendingCards.length - 1; index >= 0; index -= 1) {
      const pending = this.pendingCards[index]
      const progress = advanceEffectCardWindup(pending.elapsedMs, deltaMs)
      pending.elapsedMs = progress.elapsedMs
      this.updateEjectionVisual(pending)
      if (!progress.isReady) continue

      this.pendingCards.splice(index, 1)
      readyCards.unshift(pending)
    }
    for (const pending of readyCards) {
      this.destroyAttachment(pending.attachment)
      this.triggerThunder(pending.sourceX, pending.sourceY)
    }
  }

  public cancelPending(): void {
    for (const pending of this.pendingCards) {
      this.destroyAttachment(pending.attachment)
    }
    this.pendingCards.length = 0
  }

  public clear(): void {
    this.cancelPending()
    for (const animation of this.activeThunderAnimations) {
      this.destroyThunderAnimation(animation)
    }
    this.activeThunderAnimations.length = 0
  }

  public destroy(): void {
    this.clear()
    this.layer.removeFromParent()
    this.layer.destroy({ children: true })
    destroySpriteSheetFrameTextures(this.textures.thunderFrames)
  }

  private updateEjectionVisual(pending: PendingThunderCard): void {
    const ejection = effectCardConfig.ejection
    const progress = pending.elapsedMs / ejection.durationMs
    pending.attachment.container.position.set(
      pending.startX + ejection.ejectionOffsetXPixels * progress,
      pending.startY + ejection.ejectionOffsetYPixels * progress,
    )
    pending.attachment.container.rotation =
      pending.startRotation + ejection.ejectionRotationRadians * progress
    pending.attachment.container.alpha = 1 - progress
  }

  private triggerThunder(sourceX: number, sourceY: number): void {
    const selectedEntities = new Set<RuntimeMimicEntity>()
    for (
      let strikeIndex = 0;
      strikeIndex < effectCardConfig.thunder.initialStrikeCount;
      strikeIndex += 1
    ) {
      const targets = this.getTargets().map(toThunderTarget)
      const selected = selectThunderTarget(targets, selectedEntities, this.random)
      const strikeX = selected?.logicalX ?? sourceX
      const strikeY = selected?.logicalY ?? sourceY
      this.addThunderAnimation(strikeX, strikeY)
      if (!selected) continue

      selectedEntities.add(selected.id)
      const damage = calculateInitialThunderDamage()
      for (const hit of collectThunderHitTargets(targets, selected)) {
        this.damageTarget(hit.id, damage)
      }
    }
  }

  private addThunderAnimation(x: number, y: number): void {
    const sprite = new AnimatedSprite({
      textures: this.textures.thunderFrames,
      autoUpdate: false,
      loop: false,
      anchor: { x: 0.5, y: 1 },
      eventMode: 'none',
      roundPixels: true,
    })
    const sheet = effectCardConfig.thunder.spriteSheet
    sprite.setSize(sheet.frameWidthPixels, sheet.frameHeightPixels)
    sprite.position.set(Math.round(x), Math.round(y))
    sprite.gotoAndStop(0)
    this.activeThunderAnimations.push({ sprite, elapsedMs: 0 })
    this.layer.addChild(sprite)
  }

  private updateThunderAnimations(deltaMs: number): void {
    const durationMs = effectCardConfig.thunder.animationDurationMs
    const frameCount = this.textures.thunderFrames.length
    for (
      let index = this.activeThunderAnimations.length - 1;
      index >= 0;
      index -= 1
    ) {
      const animation = this.activeThunderAnimations[index]
      animation.elapsedMs = Math.min(durationMs, animation.elapsedMs + deltaMs)
      if (animation.elapsedMs >= durationMs) {
        this.activeThunderAnimations.splice(index, 1)
        this.destroyThunderAnimation(animation)
        continue
      }
      const frameIndex = Math.min(
        frameCount - 1,
        Math.floor((animation.elapsedMs / durationMs) * frameCount),
      )
      animation.sprite.gotoAndStop(frameIndex)
    }
  }

  private destroyAttachment(attachment: EffectCardAttachment): void {
    attachment.container.removeFromParent()
    attachment.container.destroy({ children: true })
  }

  private destroyThunderAnimation(animation: ActiveThunderAnimation): void {
    animation.sprite.removeFromParent()
    animation.sprite.destroy({ texture: false, textureSource: false })
  }
}

function toThunderTarget(entity: RuntimeMimicEntity): RuntimeThunderTarget {
  return {
    id: entity,
    role: entity.role,
    health: entity.health,
    logicalX: entity.logicalX,
    logicalY: entity.logicalY,
    jackpotPhase: entity.jackpotLifecycle?.phase ?? null,
  }
}
