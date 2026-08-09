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
  type AttachedCardHaloConfig,
  type GlowingAttachedCardRarity,
} from '../../../configs/attachedCardConfig'
import {
  equipmentDefinitions,
  type EquipmentId,
} from '../../../configs/equipmentConfig'
import type {
  AttachedCardAssignment,
  EffectAttachedCardAssignment,
  EquipmentAttachedCardAssignment,
} from './attachedCardRules'
import {
  createAttachedCardFan,
  type AttachedCardFan,
} from './attachedCardFan'
import { getAttachedCardHaloConfig } from './attachedCardHalo'
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

interface CardFrameHaloResources {
  outlineContext: GraphicsContext
  glowContext: GraphicsContext
  blurFilter: BlurFilter
}

type HaloStrokeFills =
  | { kind: 'solid'; outline: string; glow: string }
  | { kind: 'gradient'; gradient: FillGradient }

const equipmentRarityById = new Map(
  equipmentDefinitions.map(({ id, rarity }) => [id, rarity]),
)
const cardFrameHaloResources = new Map<
  GlowingAttachedCardRarity,
  CardFrameHaloResources
>()

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
  const rarity = equipmentRarityById.get(id)
  if (!rarity) throw new Error(`Missing equipment rarity for ${id}`)
  const assignment: EquipmentAttachedCardAssignment = {
    kind: 'equipment',
    id,
    rarity,
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
  const haloConfig = getAttachedCardHaloConfig(attachment.rarity)
  if (!haloConfig) return
  const pulse = Math.sin(
    (elapsedMs / haloConfig.pulsePeriodMs) * Math.PI * 2,
  )
  attachment.halo.alpha =
    haloConfig.baseOpacityMultiplier + pulse * haloConfig.pulseAmplitude
}

function createAttachedCardAttachment(
  assignment: AttachedCardAssignment,
  textures: LoadedAttachedCardTextures,
): AttachedCardAttachment {
  const container = new Container({ eventMode: 'none' })
  const halo = createHalo(assignment)
  halo.blendMode = 'add'
  halo.alpha =
    getAttachedCardHaloConfig(assignment.rarity)?.baseOpacityMultiplier ?? 0

  if (assignment.kind === 'effect') {
    container.addChild(
      createCardSprite(textures.frames[assignment.frameId]),
      createCardSprite(textures.effectIcons[assignment.id]),
    )
  } else {
    container.addChild(
      createCardSprite(textures.frames.normal),
      createCardSprite(textures.equipmentCards[assignment.id]),
    )
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

function createHalo(assignment: AttachedCardAssignment): Container {
  if (assignment.rarity === 'N') return new Container({ eventMode: 'none' })
  return createCardFrameHalo(assignment.rarity)
}

function createCardFrameHalo(rarity: GlowingAttachedCardRarity): Container {
  const halo = new Container({ eventMode: 'none' })
  const resources = getCardFrameHaloResources(rarity)
  const glow = new Graphics({
    context: resources.glowContext,
    eventMode: 'none',
    roundPixels: true,
  })
  glow.filters = [resources.blurFilter]
  const outline = new Graphics({
    context: resources.outlineContext,
    eventMode: 'none',
    roundPixels: true,
  })
  halo.addChild(glow, outline)
  return halo
}

function getCardFrameHaloResources(
  rarity: GlowingAttachedCardRarity,
): CardFrameHaloResources {
  const existing = cardFrameHaloResources.get(rarity)
  if (existing) return existing
  const created = createCardFrameHaloResources(
    attachedCardConfig.haloByRarity[rarity],
  )
  cardFrameHaloResources.set(rarity, created)
  return created
}

function createCardFrameHaloResources(
  config: AttachedCardHaloConfig,
): CardFrameHaloResources {
  const fills = createHaloStrokeFills(config)
  const outlineContext = createHaloStrokeContext(config, fills, 'outline')
  const glowContext = createHaloStrokeContext(config, fills, 'glow')
  const blurFilter = new BlurFilter({
    strength: config.blurStrengthPixels,
    quality: config.blurQuality,
  })
  blurFilter.padding = config.blurPaddingPixels
  return { outlineContext, glowContext, blurFilter }
}

function createHaloStrokeFills(
  config: AttachedCardHaloConfig,
): HaloStrokeFills {
  if (config.color.kind === 'solid') {
    return {
      kind: 'solid',
      outline: config.color.outlineColor,
      glow: config.color.glowColor,
    }
  }
  const gradient = new FillGradient({
    type: 'linear',
    start: config.color.start,
    end: config.color.end,
    textureSpace: 'local',
    colorStops: config.color.colorStops.map((stop) => ({ ...stop })),
  })
  return { kind: 'gradient', gradient }
}

function createHaloStrokeContext(
  config: AttachedCardHaloConfig,
  fills: HaloStrokeFills,
  layer: 'outline' | 'glow',
): GraphicsContext {
  const context = addCardFramePath(
    new GraphicsContext(),
    config.cornerRadiusPixels,
  )
  const width =
    layer === 'outline'
      ? config.outlineStrokeWidthPixels
      : config.glowStrokeWidthPixels
  const alpha = layer === 'outline' ? 1 : config.glowOpacity
  if (fills.kind === 'gradient') {
    return context.stroke({
      width,
      fill: fills.gradient,
      alpha,
      alignment: 0.5,
    })
  }
  return context.stroke({
    width,
    color: fills[layer],
    alpha,
    alignment: 0.5,
  })
}

function addCardFramePath(
  context: GraphicsContext,
  cornerRadiusPixels: number,
): GraphicsContext {
  const { card } = attachedCardConfig
  return context
    .roundRect(
      -card.displayWidthPixels / 2,
      -card.displayHeightPixels / 2,
      card.displayWidthPixels,
      card.displayHeightPixels,
      cornerRadiusPixels,
    )
}
