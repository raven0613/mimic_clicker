import { BlurFilter, Container, Graphics, Sprite, Texture } from 'pixi.js'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { attachedCardConfig } from '../../../configs/attachedCardConfig'
import type { LoadedAttachedCardTextures } from '../assets/runtimeAssets'

const textures: LoadedAttachedCardTextures = {
  frames: { normal: Texture.WHITE },
  effectIcons: { thunder: Texture.EMPTY, meteorite: Texture.EMPTY },
  equipmentCards: { sword: Texture.EMPTY, ring: Texture.EMPTY },
}

describe('equipment card visual', () => {
  beforeAll(() => {
    vi.stubGlobal('document', {
      createElement: () => ({ getContext: () => null }),
    })
  })

  it('draws the shared card frame behind the equipment artwork', async () => {
    const { createEquipmentCardAttachment } = await import(
      './attachedCardVisual'
    )
    const attachment = createEquipmentCardAttachment('sword', textures)
    const children = attachment.container.children as Sprite[]

    expect(children).toHaveLength(2)
    expect(children[0].texture).toBe(textures.frames.normal)
    expect(children[1].texture).toBe(textures.equipmentCards.sword)
  })

  it('uses a stable card-shaped outline and a blurred outer glow for SR Ring', async () => {
    const { createEquipmentCardAttachment } = await import(
      './attachedCardVisual'
    )
    const attachment = createEquipmentCardAttachment('ring', textures)
    const glowLayers = attachment.halo.children as Container[]

    expect(glowLayers).toHaveLength(2)
    expect(
      glowLayers.some((layer) =>
        layer.filters?.some((filter) => filter instanceof BlurFilter),
      ),
    ).toBe(true)
    expect(
      glowLayers.some((layer) => !layer.filters),
    ).toBe(true)
  })

  it('centers the Ring outline and glow geometry on the card frame bounds', async () => {
    const { createEquipmentCardAttachment } = await import(
      './attachedCardVisual'
    )
    const attachment = createEquipmentCardAttachment('ring', textures)
    const [glow, outline] = attachment.halo.children as Graphics[]
    const { ringHalo } = attachedCardConfig

    expectFrameAlignedBounds(outline, ringHalo.outlineStrokeWidthPixels)
    expectFrameAlignedBounds(glow, ringHalo.glowStrokeWidthPixels)

    const secondAttachment = createEquipmentCardAttachment('ring', textures)
    const [secondGlow, secondOutline] =
      secondAttachment.halo.children as Graphics[]
    expect(secondOutline.context).toBe(outline.context)
    expect(secondGlow.context).toBe(glow.context)
    expect(secondGlow.filters?.[0]).toBe(glow.filters?.[0])
  })
})

function expectFrameAlignedBounds(
  graphics: Graphics,
  strokeWidthPixels: number,
): void {
  const { card } = attachedCardConfig
  expect(graphics.context.bounds).toMatchObject({
    x: -card.displayWidthPixels / 2 - strokeWidthPixels / 2,
    y: -card.displayHeightPixels / 2 - strokeWidthPixels / 2,
    width: card.displayWidthPixels + strokeWidthPixels,
    height: card.displayHeightPixels + strokeWidthPixels,
  })
}
