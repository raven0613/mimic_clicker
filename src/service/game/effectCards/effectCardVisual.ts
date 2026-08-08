import {
  Container,
  FillGradient,
  Graphics,
  GraphicsContext,
  Sprite,
} from 'pixi.js'

import {
  attachedCardConfig,
  type AttachedCardRarity,
} from '../../../configs/attachedCardConfig'
import {
  createAttachedCardFan,
  type AttachedCardFan,
} from '../attachedCards/attachedCardFan'
import type { LoadedEffectCardTextures } from '../assets/runtimeAssets'
import type { EffectCardAssignment } from './effectCardRules'

export interface EffectCardAttachment {
  id: EffectCardAssignment['id']
  rarity: AttachedCardRarity
  container: Container
  halo: Graphics
}

export type EffectCardFan = AttachedCardFan<EffectCardAttachment>

const haloContexts: Record<AttachedCardRarity, GraphicsContext> = {
  normal: createHaloContext('normal'),
  ssr: createHaloContext('ssr'),
}

function createHaloContext(rarity: AttachedCardRarity): GraphicsContext {
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

export function createEffectCardFan(
  assignments: readonly EffectCardAssignment[],
  textures: LoadedEffectCardTextures,
): EffectCardFan | null {
  if (assignments.length === 0) return null

  const effectCards = assignments.map((assignment) => {
    const attachment = createEffectCardAttachment(assignment, textures)
    return attachment
  })
  return createAttachedCardFan(effectCards)
}

function createEffectCardAttachment(
  assignment: EffectCardAssignment,
  textures: LoadedEffectCardTextures,
): EffectCardAttachment {
  const { card } = attachedCardConfig
  const container = new Container({ eventMode: 'none' })
  const halo = new Graphics({
    context: haloContexts[assignment.rarity],
    eventMode: 'none',
    roundPixels: true,
  })
  const frame = new Sprite({
    texture: textures.frames[assignment.frameId],
    anchor: 0.5,
    eventMode: 'none',
    roundPixels: true,
  })
  const icon = new Sprite({
    texture: textures.icons[assignment.id],
    anchor: 0.5,
    eventMode: 'none',
    roundPixels: true,
  })

  frame.setSize(card.displayWidthPixels, card.displayHeightPixels)
  icon.setSize(card.displayWidthPixels, card.displayHeightPixels)
  halo.blendMode = 'add'
  halo.alpha =
    attachedCardConfig.haloByRarity[assignment.rarity].baseOpacityMultiplier
  container.addChild(frame, icon)
  return {
    id: assignment.id,
    rarity: assignment.rarity,
    container,
    halo,
  }
}

export function updateEffectCardHalo(
  attachment: EffectCardAttachment,
  elapsedMs: number,
): void {
  const halo = attachedCardConfig.haloByRarity[attachment.rarity]
  const pulse = Math.sin((elapsedMs / halo.pulsePeriodMs) * Math.PI * 2)
  attachment.halo.alpha =
    halo.baseOpacityMultiplier + pulse * halo.pulseAmplitude
}
