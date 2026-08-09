import { AnimatedSprite, Color, Container, Texture } from 'pixi.js'
import { describe, expect, it } from 'vitest'

import { equipmentConfig } from '../../../configs/equipmentConfig'
import { HitEffectSystem } from './HitEffectSystem'

describe('hit effect system', () => {
  it('converts the configured CSS tint once when creating an extra hit sprite', () => {
    const stage = new Container()
    const system = new HitEffectSystem(stage, { hitFrames: [Texture.WHITE] })

    system.add(
      { x: 0, y: 0 },
      equipmentConfig.ring.additionalHitEffectTintColor,
    )

    const layer = stage.children[0] as Container
    const sprite = layer.children[0] as AnimatedSprite
    expect(sprite.tint).toBe(
      new Color(equipmentConfig.ring.additionalHitEffectTintColor).toNumber(),
    )
  })
})
