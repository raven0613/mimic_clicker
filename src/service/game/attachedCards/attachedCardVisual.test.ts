import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { BlurFilter, Container, Graphics, Sprite, Texture } from 'pixi.js'

import {
  attachedCardConfig,
  glowingAttachedCardRarities,
  type AttachedCardRarity,
} from '../../../configs/attachedCardConfig'
import type { LoadedAttachedCardTextures } from '../assets/runtimeAssets'

const textures: LoadedAttachedCardTextures = {
  frames: { normal: Texture.WHITE },
  effectIcons: {
    thunder: Texture.EMPTY,
    meteorite: Texture.EMPTY,
    tornado: Texture.EMPTY,
  },
  equipmentCards: { sword: Texture.EMPTY, ring: Texture.EMPTY },
}

describe('attached card visual', () => {
  beforeAll(() => {
    vi.stubGlobal('document', {
      createElement: () => ({
        getContext: () => ({
          createLinearGradient: () => ({ addColorStop: () => undefined }),
          fillRect: () => undefined,
        }),
      }),
    })
  })

  afterAll(() => {
    vi.unstubAllGlobals()
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

  it('does not create halo graphics or filters for N cards', async () => {
    const { createAttachedCardFanVisual, createEquipmentCardAttachment } =
      await import('./attachedCardVisual')
    const sword = createEquipmentCardAttachment('sword', textures)
    const thunderFan = createAttachedCardFanVisual(
      [
        {
          kind: 'effect',
          id: 'thunder',
          frameId: 'normal',
          rarity: 'N',
        },
      ],
      textures,
    )

    expect(sword.halo.children).toHaveLength(0)
    expect(sword.halo.filters).toBeFalsy()
    expect(thunderFan!.cards[0].halo.children).toHaveLength(0)
    expect(thunderFan!.cards[0].halo.filters).toBeFalsy()
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
    const haloConfig = attachedCardConfig.haloByRarity.SR

    expectFrameAlignedBounds(outline, haloConfig.outlineStrokeWidthPixels)
    expectFrameAlignedBounds(glow, haloConfig.glowStrokeWidthPixels)

    const secondAttachment = createEquipmentCardAttachment('ring', textures)
    const [secondGlow, secondOutline] =
      secondAttachment.halo.children as Graphics[]
    expect(secondOutline.context).toBe(outline.context)
    expect(secondGlow.context).toBe(glow.context)
    expect(secondGlow.filters?.[0]).toBe(glow.filters?.[0])
  })

  it('shares the same SR halo resources between Ring and tornado', async () => {
    const { createAttachedCardFanVisual, createEquipmentCardAttachment } =
      await import('./attachedCardVisual')
    const ring = createEquipmentCardAttachment('ring', textures)
    const tornadoFan = createAttachedCardFanVisual(
      [
        {
          kind: 'effect',
          id: 'tornado',
          frameId: 'normal',
          rarity: 'SR',
        },
      ],
      textures,
    )
    const [ringGlow, ringOutline] = ring.halo.children as Graphics[]
    const [tornadoGlow, tornadoOutline] = tornadoFan!.cards[0].halo
      .children as Graphics[]
    const haloConfig = attachedCardConfig.haloByRarity.SR

    expectFrameAlignedBounds(
      tornadoOutline,
      haloConfig.outlineStrokeWidthPixels,
    )
    expectFrameAlignedBounds(tornadoGlow, haloConfig.glowStrokeWidthPixels)
    expect(tornadoGlow.filters?.[0]).toBeInstanceOf(BlurFilter)
    expect(tornadoOutline.context).toBe(ringOutline.context)
    expect(tornadoGlow.context).toBe(ringGlow.context)
    expect(tornadoGlow.filters?.[0]).toBe(ringGlow.filters?.[0])
  })

  it('uses the latest card-frame halo for every glowing rarity', async () => {
    const { createAttachedCardFanVisual } = await import(
      './attachedCardVisual'
    )
    for (const rarity of glowingAttachedCardRarities) {
      const fan = createAttachedCardFanVisual(
        [createEffectAssignment(rarity)],
        textures,
      )
      const [glow, outline] = fan!.cards[0].halo.children as Graphics[]
      const haloConfig = attachedCardConfig.haloByRarity[rarity]

      expectFrameAlignedBounds(
        outline,
        haloConfig.outlineStrokeWidthPixels,
      )
      expectFrameAlignedBounds(glow, haloConfig.glowStrokeWidthPixels)
      expect(glow.filters?.[0]).toBeInstanceOf(BlurFilter)
    }
  })
})

function createEffectAssignment(rarity: AttachedCardRarity) {
  return {
    kind: 'effect' as const,
    id: 'thunder' as const,
    frameId: 'normal' as const,
    rarity,
  }
}

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
