import {
  BlurFilter,
  Container,
  FillGradient,
  Graphics,
  GraphicsContext,
  Sprite,
} from 'pixi.js'

import {
  attachedCardConfig,
  type EffectCardRarity,
} from '../../../configs/attachedCardConfig'
import type { EquipmentId } from '../../../configs/equipmentConfig'
import type {
  AttachedCardAssignment,
  EffectAttachedCardAssignment,
  EquipmentAttachedCardAssignment,
} from './attachedCardRules'
import {
  createAttachedCardFan,
  type AttachedCardFan,
} from './attachedCardFan'
import type { LoadedAttachedCardTextures } from '../assets/runtimeAssets'

interface AttachedCardVisual {
  container: Container
  halo: Container
}

export type EffectCardAttachment = EffectAttachedCardAssignment &
  AttachedCardVisual
export type EquipmentCardAttachment = EquipmentAttachedCardAssignment &
  AttachedCardVisual
export type AttachedCardAttachment =
  | EffectCardAttachment
  | EquipmentCardAttachment
export type RuntimeAttachedCardFan = AttachedCardFan<AttachedCardAttachment>

const effectHaloContexts: Partial<Record<EffectCardRarity, GraphicsContext>> = {}
const ringOutlineContext = createRingOutlineContext()
const ringGlowContext = createRingGlowContext()
const ringGlowBlurFilter = new BlurFilter({
  strength: attachedCardConfig.ringHalo.blurStrengthPixels,
  quality: attachedCardConfig.ringHalo.blurQuality,
})
ringGlowBlurFilter.padding = attachedCardConfig.ringHalo.blurPaddingPixels

export function createAttachedCardFanVisual(
  assignments: readonly AttachedCardAssignment[],
  textures: LoadedAttachedCardTextures,
): RuntimeAttachedCardFan | null {
  if (assignments.length === 0) return null
  return createAttachedCardFan(
    assignments.map((assignment) =>
      createAttachedCardAttachment(assignment, textures),
    ),
  )
}

export function createEquipmentCardAttachment(
  id: EquipmentId,
  textures: LoadedAttachedCardTextures,
): EquipmentCardAttachment {
  const assignment: EquipmentAttachedCardAssignment = {
    kind: 'equipment',
    id,
    rarity: id === 'ring' ? 'sr' : 'normal',
  }
  return createAttachedCardAttachment(
    assignment,
    textures,
  ) as EquipmentCardAttachment
}

export function updateAttachedCardHalo(
  attachment: AttachedCardAttachment,
  elapsedMs: number,
): void {
  if (attachment.kind === 'equipment' && attachment.id === 'sword') return
  const halo =
    attachment.kind === 'equipment'
      ? attachedCardConfig.ringHalo
      : attachedCardConfig.haloByRarity[attachment.rarity]
  const pulse = Math.sin((elapsedMs / halo.pulsePeriodMs) * Math.PI * 2)
  attachment.halo.alpha =
    halo.baseOpacityMultiplier + pulse * halo.pulseAmplitude
}

function createAttachedCardAttachment(
  assignment: AttachedCardAssignment,
  textures: LoadedAttachedCardTextures,
): AttachedCardAttachment {
  const container = new Container({ eventMode: 'none' })
  const halo = createHalo(assignment)
  halo.blendMode = 'add'

  if (assignment.kind === 'effect') {
    container.addChild(
      createCardSprite(textures.frames[assignment.frameId]),
      createCardSprite(textures.effectIcons[assignment.id]),
    )
    halo.alpha =
      attachedCardConfig.haloByRarity[assignment.rarity]
        .baseOpacityMultiplier
  } else {
    container.addChild(
      createCardSprite(textures.frames.normal),
      createCardSprite(textures.equipmentCards[assignment.id]),
    )
    halo.alpha =
      assignment.id === 'ring'
        ? attachedCardConfig.ringHalo.baseOpacityMultiplier
        : 0
  }

  return { ...assignment, container, halo } as AttachedCardAttachment
}

function createCardSprite(texture: Sprite['texture']): Sprite {
  const sprite = new Sprite({
    texture,
    anchor: 0.5,
    eventMode: 'none',
    roundPixels: true,
  })
  sprite.setSize(
    attachedCardConfig.card.displayWidthPixels,
    attachedCardConfig.card.displayHeightPixels,
  )
  return sprite
}

function createHalo(
  assignment: AttachedCardAssignment,
): Container {
  if (assignment.kind === 'effect') {
    return new Graphics({
      context: getEffectHaloContext(assignment.rarity),
      eventMode: 'none',
      roundPixels: true,
    })
  }
  if (assignment.id === 'sword') {
    return new Container({ eventMode: 'none' })
  }

  const halo = new Container({ eventMode: 'none' })
  const glow = new Graphics({
    context: ringGlowContext,
    eventMode: 'none',
    roundPixels: true,
  })
  glow.filters = [ringGlowBlurFilter]
  const outline = new Graphics({
    context: ringOutlineContext,
    eventMode: 'none',
    roundPixels: true,
  })
  halo.addChild(glow, outline)
  return halo
}

function getEffectHaloContext(rarity: EffectCardRarity): GraphicsContext {
  const existing = effectHaloContexts[rarity]
  if (existing) return existing
  const created = createEffectHaloContext(rarity)
  effectHaloContexts[rarity] = created
  return created
}

function createEffectHaloContext(rarity: EffectCardRarity): GraphicsContext {
  const { card } = attachedCardConfig
  const halo = attachedCardConfig.haloByRarity[rarity]
  const gradient = new FillGradient({
    type: 'radial',
    center: { x: 0.5, y: 0.5 },
    innerRadius: 0,
    outerCenter: { x: 0.5, y: 0.5 },
    outerRadius: 0.5,
    textureSpace: 'local',
    colorStops: halo.gradientColorStops.map((stop) => ({ ...stop })),
  })
  return new GraphicsContext()
    .ellipse(
      0,
      0,
      card.displayWidthPixels / 2 + halo.outerExpansionPixels,
      card.displayHeightPixels / 2 + halo.outerExpansionPixels,
    )
    .fill(gradient)
}

function createRingOutlineContext(): GraphicsContext {
  const { ringHalo } = attachedCardConfig
  return addRingFramePath(new GraphicsContext())
    .stroke({
      width: ringHalo.outlineStrokeWidthPixels,
      color: ringHalo.outlineColor,
      alignment: 0.5,
    })
}

function createRingGlowContext(): GraphicsContext {
  const { ringHalo } = attachedCardConfig
  return addRingFramePath(new GraphicsContext())
    .stroke({
      width: ringHalo.glowStrokeWidthPixels,
      color: ringHalo.glowColor,
      alpha: ringHalo.glowOpacity,
      alignment: 0.5,
    })
}

function addRingFramePath(context: GraphicsContext): GraphicsContext {
  const { card, ringHalo } = attachedCardConfig
  return context
    .roundRect(
      -card.displayWidthPixels / 2,
      -card.displayHeightPixels / 2,
      card.displayWidthPixels,
      card.displayHeightPixels,
      ringHalo.cornerRadiusPixels,
    )
}
