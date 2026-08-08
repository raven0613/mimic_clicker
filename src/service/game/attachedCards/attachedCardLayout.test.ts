import { describe, expect, it } from 'vitest'

import { attachedCardConfig } from '../../../configs/attachedCardConfig'
import {
  attachedCardFanContainsPoint,
  createAttachedCardFanLayout,
} from './attachedCardLayout'

describe('attached-card fan layout', () => {
  it('displays cards at one eighth of their source dimensions', () => {
    const card = attachedCardConfig.card

    expect(card.displayWidthPixels).toBe(card.sourceWidthPixels / 8)
    expect(card.displayHeightPixels).toBe(card.sourceHeightPixels / 8)
  })

  it('uses one fixed transform for a single attached card', () => {
    const first = createAttachedCardFanLayout(1)
    const second = createAttachedCardFanLayout(1)

    expect(first).toEqual(second)
    expect(first.cards).toEqual([
      { x: 0, y: 0, rotationRadians: 0, drawOrder: 0 },
    ])
    expect(first.x).toBe(attachedCardConfig.fan.offsetXPixels)
    expect(first.y).toBe(attachedCardConfig.fan.offsetYPixels)
    expect(first.rotationRadians).toBe(
      attachedCardConfig.fan.clockwiseRotationRadians,
    )
  })

  it('fans multiple cards apart without changing their deterministic order', () => {
    const layout = createAttachedCardFanLayout(
      attachedCardConfig.capacity.jackpot.maximum,
    )

    expect(layout.cards).toHaveLength(
      attachedCardConfig.capacity.jackpot.maximum,
    )
    expect(layout.cards.map((card) => card.drawOrder)).toEqual(
      layout.cards.map((_, index) => index),
    )
    for (let index = 1; index < layout.cards.length; index += 1) {
      expect(layout.cards[index].x - layout.cards[index - 1].x).toBe(
        attachedCardConfig.fan.cardCenterSpacingXPixels,
      )
      expect(layout.cards[index].rotationRadians).toBeGreaterThan(
        layout.cards[index - 1].rotationRadians,
      )
    }
  })

  it('hit-tests the union of the individually rotated card rectangles', () => {
    const layout = createAttachedCardFanLayout(
      attachedCardConfig.capacity.jackpot.maximum,
    )

    for (const card of layout.cards) {
      const cosine = Math.cos(layout.rotationRadians)
      const sine = Math.sin(layout.rotationRadians)
      const centerX = layout.x + card.x * cosine - card.y * sine
      const centerY = layout.y + card.x * sine + card.y * cosine

      expect(attachedCardFanContainsPoint(centerX, centerY, layout)).toBe(true)
    }
    expect(
      attachedCardFanContainsPoint(
        layout.x + attachedCardConfig.card.displayWidthPixels * 10,
        layout.y,
        layout,
      ),
    ).toBe(false)
  })
})
