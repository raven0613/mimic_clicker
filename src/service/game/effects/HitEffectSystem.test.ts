import { AnimatedSprite, Color, Container, Texture } from 'pixi.js'
import { describe, expect, it } from 'vitest'

import { equipmentConfig } from '../../../configs/equipmentConfig'
import { permanentUpgradeConfig } from '../../../configs/permanentUpgradeConfig'
import { HitEffectSystem } from './HitEffectSystem'

describe('hit effect system', () => {
  it.each([
    ['Ring', equipmentConfig.ring.additionalHitEffectTintColor],
    [
      'automatic weapon',
      permanentUpgradeConfig.hoverAutoAttack.hitEffectTintColor,
    ],
  ])(
    'converts the configured %s CSS tint when creating a hit sprite',
    (_, tintColor) => {
      const stage = new Container()
      const system = new HitEffectSystem(stage, {
        hitFrames: [Texture.WHITE],
      })

      system.add({ x: 0, y: 0 }, tintColor)

      const layer = stage.children[0] as Container
      const sprite = layer.children[0] as AnimatedSprite
      expect(sprite.tint).toBe(new Color(tintColor).toNumber())
    },
  )
})
