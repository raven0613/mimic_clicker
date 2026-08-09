import { Container } from 'pixi.js'

import { animationConfig } from '../../../configs/animationConfig'
import {
  equipmentDefinitions,
  type EquipmentId,
} from '../../../configs/equipmentConfig'
import type {
  EquipmentCollectionTargets,
  RandomSource,
  Vector2,
} from '../../../types/game'
import type { LoadedAttachedCardTextures } from '../assets/runtimeAssets'
import { moveAttachedCardDisplayToLayer } from '../attachedCards/attachedCardLayerTransfer'
import {
  createEquipmentCardAttachment,
  updateAttachedCardHalo,
  type EquipmentCardAttachment,
} from '../attachedCards/attachedCardVisual'
import { selectVisibleEquipmentDrops } from './equipmentDropRules'
import {
  EquipmentState,
  type AcceptedManualHit,
  type EquipmentReservation,
  type RingStrike,
} from './equipmentState'
import {
  advanceEquipmentRewardMotion,
  createEquipmentRewardMotion,
  isEquipmentRewardMotionSettled,
  type EquipmentRewardMotion,
} from './equipmentRewardMotion'

interface ResolveEquipmentDropsInput {
  visibleCards: readonly EquipmentCardAttachment[]
  hiddenEquipmentId: EquipmentId | null
  source: Vector2
  fieldHeight: number
  rewardEventId: number | null
}

interface EquipmentVisual {
  attachment: EquipmentCardAttachment
  x: number
  y: number
  rotation: number
  scale: number
}

interface PendingEquipmentReward extends EquipmentVisual {
  reservation: EquipmentReservation
  motion: EquipmentRewardMotion
  elapsedMs: number
  collectionElapsedMs: number
  collectionReadyAtMs: number
  collectionStarted: boolean
  collectionStartX: number
  collectionStartY: number
  collectionStartRotation: number
  rewardEventId: number | null
}

interface FailedEquipmentDrop extends EquipmentVisual {
  elapsedMs: number
}

interface EquippedEquipmentVisual extends EquipmentVisual {
  slotIndex: number
}

const rarityByEquipmentId = new Map(
  equipmentDefinitions.map(({ id, rarity }) => [id, rarity]),
)

export class EquipmentRewardSystem {
  private readonly haloLayer = new Container({ eventMode: 'none' })
  private readonly cardLayer = new Container({ eventMode: 'none' })
  private readonly pendingRewards: PendingEquipmentReward[] = []
  private readonly failedDrops: FailedEquipmentDrop[] = []
  private readonly equippedVisuals: EquippedEquipmentVisual[] = []
  private readonly state = new EquipmentState()
  private readonly host: HTMLElement
  private readonly textures: LoadedAttachedCardTextures
  private readonly random: RandomSource
  private collectionTargets: EquipmentCollectionTargets = {
    slotTargets: [],
    backpackTarget: null,
  }
  private haloElapsedMs = 0

  public constructor(
    stage: Container,
    host: HTMLElement,
    textures: LoadedAttachedCardTextures,
    random: RandomSource,
  ) {
    this.host = host
    this.textures = textures
    this.random = random
    stage.addChild(this.haloLayer, this.cardLayer)
  }

  public setCollectionTargetsFromViewport(
    targets: EquipmentCollectionTargets,
    fieldSize: Vector2,
  ): void {
    const hostBounds = this.host.getBoundingClientRect()
    if (hostBounds.width <= 0 || hostBounds.height <= 0) return
    const convert = (target: Vector2 | null): Vector2 | null =>
      target === null
        ? null
        : {
            x:
              (target.x - hostBounds.left) *
              (fieldSize.x / hostBounds.width),
            y:
              (target.y - hostBounds.top) *
              (fieldSize.y / hostBounds.height),
          }
    this.collectionTargets = {
      slotTargets: targets.slotTargets.map(convert),
      backpackTarget: convert(targets.backpackTarget),
    }
  }

  public resolveDrops(input: ResolveEquipmentDropsInput): void {
    const visibleDrops = selectVisibleEquipmentDrops(
      input.visibleCards,
      this.random,
    )
    for (const attachment of visibleDrops.failed) {
      this.failedDrops.push({
        ...this.captureVisibleAttachment(attachment),
        elapsedMs: 0,
      })
    }

    const successfulAttachments = [...visibleDrops.successful]
    if (input.hiddenEquipmentId !== null) {
      const hiddenAttachment = createEquipmentCardAttachment(
        input.hiddenEquipmentId,
        this.textures,
      )
      this.addAttachmentAt(hiddenAttachment, input.source)
      successfulAttachments.push(hiddenAttachment)
    }
    const reservations = this.state.reserveDrops(
      successfulAttachments.map(({ id }) => ({
        id,
        rarity: this.getRarity(id),
      })),
    )

    for (let index = 0; index < successfulAttachments.length; index += 1) {
      const attachment = successfulAttachments[index]
      const visual = input.visibleCards.includes(attachment)
        ? this.captureVisibleAttachment(attachment)
        : this.captureAttachment(attachment)
      const motion = createEquipmentRewardMotion({
        x: visual.x,
        y: visual.y,
        fieldHeight: input.fieldHeight,
        random: this.random,
      })
      motion.rotation = visual.rotation
      this.pendingRewards.push({
        ...visual,
        reservation: reservations[index],
        motion,
        elapsedMs: 0,
        collectionElapsedMs: 0,
        collectionReadyAtMs:
          input.rewardEventId === null
            ? animationConfig.equipmentReward.noCoinFallbackDelayMs
            : Number.POSITIVE_INFINITY,
        collectionStarted: false,
        collectionStartX: visual.x,
        collectionStartY: visual.y,
        collectionStartRotation: visual.rotation,
        rewardEventId: input.rewardEventId,
      })
    }
  }

  public notifyCoinCollectionCompleted(rewardEventId: number): void {
    for (const reward of this.pendingRewards) {
      if (reward.rewardEventId !== rewardEventId) continue
      reward.collectionReadyAtMs =
        reward.elapsedMs +
        animationConfig.equipmentReward.postCoinCollectionDelayMs
    }
  }

  public calculateWeaponDamage(baseDamage: number): number {
    return this.state.calculateWeaponDamage(baseDamage)
  }

  public getSettlementEquipmentSnapshot(): EquipmentId[] {
    return this.state.getSettlementEquipmentSnapshot()
  }

  public recordAcceptedManualHit(hit: AcceptedManualHit): void {
    this.state.recordAcceptedManualHit(hit)
  }

  public advanceRingQueue(
    deltaMs: number,
    includeEndpoint = true,
  ): RingStrike[] {
    return this.state.advanceRingQueue(deltaMs, includeEndpoint)
  }

  public update(deltaMs: number): void {
    this.haloElapsedMs += deltaMs
    this.updateFailedDrops(deltaMs)
    this.updatePendingRewards(deltaMs)
    this.updateEquippedVisuals()
  }

  public clear(): void {
    for (const reward of this.pendingRewards) {
      this.state.cancelReservation(reward.reservation.reservationId)
      this.destroyAttachment(reward.attachment)
    }
    for (const drop of this.failedDrops) {
      this.destroyAttachment(drop.attachment)
    }
    for (const visual of this.equippedVisuals) {
      this.destroyAttachment(visual.attachment)
    }
    this.pendingRewards.length = 0
    this.failedDrops.length = 0
    this.equippedVisuals.length = 0
    this.haloElapsedMs = 0
    this.state.clear()
  }

  public destroy(): void {
    this.clear()
    this.haloLayer.removeFromParent()
    this.cardLayer.removeFromParent()
    this.haloLayer.destroy({ children: true })
    this.cardLayer.destroy({ children: true })
  }

  private updateFailedDrops(deltaMs: number): void {
    const config = animationConfig.equipmentReward
    for (let index = this.failedDrops.length - 1; index >= 0; index -= 1) {
      const drop = this.failedDrops[index]
      drop.elapsedMs += deltaMs
      const progress = Math.min(1, drop.elapsedMs / config.failedDropDurationMs)
      updateAttachedCardHalo(drop.attachment, this.haloElapsedMs)
      this.applyTransform(
        drop,
        drop.x,
        drop.y + config.failedDropOffsetYPixels * progress,
        drop.rotation,
        drop.scale,
      )
      drop.attachment.container.alpha = 1 - progress
      drop.attachment.halo.alpha *= 1 - progress
      if (progress < 1) continue
      this.failedDrops.splice(index, 1)
      this.destroyAttachment(drop.attachment)
    }
  }

  private updatePendingRewards(deltaMs: number): void {
    const config = animationConfig.equipmentReward
    for (let index = this.pendingRewards.length - 1; index >= 0; index -= 1) {
      const reward = this.pendingRewards[index]
      reward.elapsedMs += deltaMs
      updateAttachedCardHalo(reward.attachment, this.haloElapsedMs)

      if (!reward.collectionStarted) {
        advanceEquipmentRewardMotion(reward.motion, deltaMs)
        this.applyTransform(
          reward,
          reward.motion.x,
          reward.motion.y,
          reward.motion.rotation,
          reward.scale,
        )
        if (!isEquipmentRewardMotionSettled(reward.motion)) continue
      }
      if (reward.elapsedMs < reward.collectionReadyAtMs) continue

      const target = this.getReservationTarget(reward.reservation)
      if (target === null) continue
      if (!reward.collectionStarted) {
        reward.collectionStarted = true
        reward.collectionStartX = reward.attachment.container.x
        reward.collectionStartY = reward.attachment.container.y
        reward.collectionStartRotation = reward.attachment.container.rotation
      }
      reward.collectionElapsedMs += deltaMs
      const progress = Math.min(
        1,
        reward.collectionElapsedMs / config.collectionDurationMs,
      )
      const easedProgress = 1 - (1 - progress) ** 3
      this.applyTransform(
        reward,
        interpolate(reward.collectionStartX, target.x, easedProgress),
        interpolate(reward.collectionStartY, target.y, easedProgress) -
          Math.sin(progress * Math.PI) * config.collectionArcHeightPixels,
        interpolate(
          reward.collectionStartRotation,
          0,
          easedProgress,
        ),
        interpolate(reward.scale, config.endingScale, easedProgress),
      )
      if (progress < 1) continue
      this.completeReward(index, reward, target)
    }
  }

  private completeReward(
    index: number,
    reward: PendingEquipmentReward,
    target: Vector2,
  ): void {
    this.pendingRewards.splice(index, 1)
    this.state.completeReservation(reward.reservation.reservationId)
    if (reward.reservation.destination.type === 'backpack') {
      this.destroyAttachment(reward.attachment)
      return
    }
    this.applyTransform(
      reward,
      target.x,
      target.y,
      0,
      animationConfig.equipmentReward.endingScale,
    )
    this.equippedVisuals.push({
      attachment: reward.attachment,
      slotIndex: reward.reservation.destination.slotIndex,
      x: target.x,
      y: target.y,
      rotation: 0,
      scale: animationConfig.equipmentReward.endingScale,
    })
  }

  private updateEquippedVisuals(): void {
    for (const visual of this.equippedVisuals) {
      updateAttachedCardHalo(visual.attachment, this.haloElapsedMs)
      const target = this.collectionTargets.slotTargets[visual.slotIndex]
      if (!target) continue
      visual.x = target.x
      visual.y = target.y
      this.applyTransform(visual, target.x, target.y, 0, visual.scale)
    }
  }

  private getReservationTarget(
    reservation: EquipmentReservation,
  ): Vector2 | null {
    return reservation.destination.type === 'slot'
      ? (this.collectionTargets.slotTargets[
          reservation.destination.slotIndex
        ] ?? null)
      : this.collectionTargets.backpackTarget
  }

  private captureVisibleAttachment(
    attachment: EquipmentCardAttachment,
  ): EquipmentVisual {
    moveAttachedCardDisplayToLayer(attachment.halo, this.haloLayer)
    moveAttachedCardDisplayToLayer(attachment.container, this.cardLayer)
    return this.captureAttachment(attachment)
  }

  private captureAttachment(
    attachment: EquipmentCardAttachment,
  ): EquipmentVisual {
    return {
      attachment,
      x: attachment.container.x,
      y: attachment.container.y,
      rotation: attachment.container.rotation,
      scale: attachment.container.scale.x,
    }
  }

  private addAttachmentAt(
    attachment: EquipmentCardAttachment,
    position: Vector2,
  ): void {
    attachment.halo.position.copyFrom(position)
    attachment.container.position.copyFrom(position)
    this.haloLayer.addChild(attachment.halo)
    this.cardLayer.addChild(attachment.container)
  }

  private applyTransform(
    visual: EquipmentVisual,
    x: number,
    y: number,
    rotation: number,
    scale: number,
  ): void {
    visual.attachment.halo.position.set(x, y)
    visual.attachment.halo.rotation = rotation
    visual.attachment.halo.scale.set(scale)
    visual.attachment.container.position.set(x, y)
    visual.attachment.container.rotation = rotation
    visual.attachment.container.scale.set(scale)
  }

  private getRarity(id: EquipmentId) {
    const rarity = rarityByEquipmentId.get(id)
    if (!rarity) throw new Error(`Missing equipment definition for ${id}`)
    return rarity
  }

  private destroyAttachment(attachment: EquipmentCardAttachment): void {
    attachment.halo.removeFromParent()
    attachment.container.removeFromParent()
    attachment.halo.destroy({ children: true })
    attachment.container.destroy({ children: true })
  }
}

function interpolate(start: number, end: number, progress: number): number {
  return start + (end - start) * progress
}
