import { Container } from 'pixi.js'

import { effectCardConfig } from '../../../configs/effectCardConfig'
import type { RandomSource } from '../../../types/game'
import { destroySpriteSheetFrameTextures } from '../assets/horizontalSpriteSheetTextures'
import type { LoadedEffectCardTextures } from '../assets/runtimeAssets'
import type { RuntimeMimicEntity } from '../runtimeTypes'
import { advanceEffectCardWindup } from './effectCardRules'
import type { EffectCardAttachment } from '../attachedCards/attachedCardVisual'
import { MeteoriteEffectSystem } from './MeteoriteEffectSystem'
import { ThunderEffectSystem } from './ThunderEffectSystem'
import { TornadoEffectSystem } from './TornadoEffectSystem'

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
  private readonly tornadoSystem: TornadoEffectSystem
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
    this.tornadoSystem = new TornadoEffectSystem(
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
    this.tornadoSystem.update(deltaMs)
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
    this.tornadoSystem.clear()
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
    destroySpriteSheetFrameTextures(this.textures.tornadoStartFrames)
    destroySpriteSheetFrameTextures(this.textures.tornadoRunFrames)
    destroySpriteSheetFrameTextures(this.textures.tornadoEndFrames)
  }

  public resetTargetDamageInterval(target: RuntimeMimicEntity): void {
    this.tornadoSystem.resetTargetDamageInterval(target)
  }

  public hasActiveEffects(): boolean {
    return (
      this.pendingCards.length > 0 ||
      this.thunderSystem.hasActiveEffects() ||
      this.meteoriteSystem.hasActiveEffects() ||
      this.tornadoSystem.hasActiveEffects()
    )
  }

  private dispatch(pending: PendingEffectCard): void {
    const { id } = pending.attachment
    this.destroyAttachment(pending.attachment)
    if (id === 'thunder') {
      this.thunderSystem.trigger({ x: pending.sourceX, y: pending.sourceY })
      return
    }
    if (id === 'meteorite') {
      this.meteoriteSystem.trigger()
      return
    }
    if (id === 'tornado') {
      this.tornadoSystem.trigger({ x: pending.sourceX, y: pending.sourceY })
      return
    }
    const unreachableId: never = id
    throw new Error(`Unsupported effect card id: ${unreachableId}`)
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
