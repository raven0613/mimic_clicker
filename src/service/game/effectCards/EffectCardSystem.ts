import { Container } from 'pixi.js'

import { effectCardConfig } from '../../../configs/effectCardConfig'
import type { RandomSource } from '../../../types/game'
import { destroySpriteSheetFrameTextures } from '../assets/horizontalSpriteSheetTextures'
import type { LoadedEffectCardTextures } from '../assets/runtimeAssets'
import type { RuntimeMimicEntity } from '../runtimeTypes'
import { advanceEffectCardWindup } from './effectCardRules'
import type { EffectCardAttachment } from './effectCardVisual'
import { MeteoriteEffectSystem } from './MeteoriteEffectSystem'
import { ThunderEffectSystem } from './ThunderEffectSystem'

interface PendingEffectCard {
  attachment: EffectCardAttachment
  sourceX: number
  sourceY: number
  startX: number
  startY: number
  startRotation: number
  elapsedMs: number
}

export class EffectCardSystem {
  private readonly layer = new Container({ eventMode: 'none' })
  private readonly pendingCards: PendingEffectCard[] = []
  private readonly thunderSystem: ThunderEffectSystem
  private readonly meteoriteSystem: MeteoriteEffectSystem
  private readonly textures: LoadedEffectCardTextures

  public constructor(
    stage: Container,
    textures: LoadedEffectCardTextures,
    random: RandomSource,
    getFieldSize: () => { width: number; height: number },
    getTargets: () => readonly RuntimeMimicEntity[],
    damageTarget: (entity: RuntimeMimicEntity, damage: number) => void,
  ) {
    this.textures = textures
    stage.addChild(this.layer)
    this.thunderSystem = new ThunderEffectSystem(
      this.layer,
      textures.thunderFrames,
      random,
      getTargets,
      damageTarget,
    )
    this.meteoriteSystem = new MeteoriteEffectSystem(
      this.layer,
      textures,
      random,
      getFieldSize,
      getTargets,
      damageTarget,
    )
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
    this.thunderSystem.update(deltaMs)
    this.meteoriteSystem.update(deltaMs)
    const readyCards: PendingEffectCard[] = []
    for (let index = this.pendingCards.length - 1; index >= 0; index -= 1) {
      const pending = this.pendingCards[index]
      const progress = advanceEffectCardWindup(pending.elapsedMs, deltaMs)
      pending.elapsedMs = progress.elapsedMs
      this.updateEjectionVisual(pending)
      if (!progress.isReady) continue

      this.pendingCards.splice(index, 1)
      readyCards.unshift(pending)
    }
    for (const pending of readyCards) this.dispatch(pending)
  }

  public cancelUnresolved(): void {
    for (const pending of this.pendingCards) {
      this.destroyAttachment(pending.attachment)
    }
    this.pendingCards.length = 0
    this.meteoriteSystem.cancelUnresolved()
  }

  public clear(): void {
    this.cancelUnresolved()
    this.thunderSystem.clear()
    this.meteoriteSystem.clear()
  }

  public destroy(): void {
    this.clear()
    this.layer.removeFromParent()
    this.layer.destroy({ children: true })
    destroySpriteSheetFrameTextures(this.textures.thunderFrames)
    destroySpriteSheetFrameTextures(this.textures.meteoriteFrames)
    destroySpriteSheetFrameTextures(this.textures.explosionFrames)
  }

  private dispatch(pending: PendingEffectCard): void {
    const { id } = pending.attachment
    this.destroyAttachment(pending.attachment)
    if (id === 'thunder') {
      this.thunderSystem.trigger({ x: pending.sourceX, y: pending.sourceY })
      return
    }
    this.meteoriteSystem.trigger()
  }

  private updateEjectionVisual(pending: PendingEffectCard): void {
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

  private destroyAttachment(attachment: EffectCardAttachment): void {
    attachment.container.removeFromParent()
    attachment.container.destroy({ children: true })
  }
}
