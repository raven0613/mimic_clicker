import { Container } from 'pixi.js'
import { describe, expect, it } from 'vitest'

import { clearFeedbackConfig } from '../../../configs/clearRefillConfig'
import { calculateRefillEntranceScale } from '../clearRefill/refillEntranceAnimation'
import { moveAttachedCardDisplayToLayer } from './attachedCardLayerTransfer'

const entrance = clearFeedbackConfig.refillEntrance
const entranceScales = [
  entrance.initialScale,
  calculateRefillEntranceScale(entrance.growDurationMs / 2),
]

describe('attached card layer transfer', () => {
  it.each(entranceScales)(
    'removes the Mimic entrance scale %s without moving the card',
    (entranceScale) => {
      const stage = new Container()
      const mimicVisual = new Container({
        x: 240,
        y: 180,
        rotation: 0.2,
        scale: entranceScale,
      })
      const card = new Container({ x: 36, y: -48, rotation: -0.1 })
      const destination = new Container({ x: 10, y: 20, rotation: 0.05 })
      stage.addChild(mimicVisual, destination)
      mimicVisual.addChild(card)
      const originalPosition = card.getGlobalPosition()
      const originalRotation = mimicVisual.rotation + card.rotation

      moveAttachedCardDisplayToLayer(card, destination)

      expect(card.parent).toBe(destination)
      expect(card.getGlobalPosition().x).toBeCloseTo(originalPosition.x)
      expect(card.getGlobalPosition().y).toBeCloseTo(originalPosition.y)
      expect(destination.rotation + card.rotation).toBeCloseTo(
        originalRotation,
      )
      expect(card.scale.x).toBe(1)
      expect(card.scale.y).toBe(1)
    },
  )
})
