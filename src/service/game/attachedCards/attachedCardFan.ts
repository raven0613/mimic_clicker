import { Container } from 'pixi.js'

import {
  createAttachedCardFanLayout,
  type AttachedCardFanLayout,
} from './attachedCardLayout'

export interface AttachedCardVisual {
  container: Container
  halo: Container
}

export interface AttachedCardFan<TCard extends AttachedCardVisual> {
  container: Container
  layout: AttachedCardFanLayout
  cards: TCard[]
}

export function createAttachedCardFan<TCard extends AttachedCardVisual>(
  cards: readonly TCard[],
): AttachedCardFan<TCard> | null {
  if (cards.length === 0) return null

  const layout = createAttachedCardFanLayout(cards.length)
  const container = new Container({ eventMode: 'none' })
  const haloLayer = new Container({ eventMode: 'none' })
  const cardLayer = new Container({ eventMode: 'none' })
  const orderedCards = [...cards]

  for (let index = 0; index < orderedCards.length; index += 1) {
    const card = orderedCards[index]
    const cardLayout = layout.cards[index]
    card.halo.position.set(cardLayout.x, cardLayout.y)
    card.halo.rotation = cardLayout.rotationRadians
    card.container.position.set(cardLayout.x, cardLayout.y)
    card.container.rotation = cardLayout.rotationRadians
    haloLayer.addChild(card.halo)
    cardLayer.addChild(card.container)
  }

  container.position.set(layout.x, layout.y)
  container.rotation = layout.rotationRadians
  container.addChild(haloLayer, cardLayer)
  return { container, layout, cards: orderedCards }
}
