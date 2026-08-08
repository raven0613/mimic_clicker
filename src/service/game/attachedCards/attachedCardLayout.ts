import { attachedCardConfig } from '../../../configs/attachedCardConfig'

export interface AttachedCardLayout {
  x: number
  y: number
  rotationRadians: number
  drawOrder: number
}

export interface AttachedCardFanLayout {
  x: number
  y: number
  rotationRadians: number
  cards: AttachedCardLayout[]
}

export function createAttachedCardFanLayout(
  requestedCardCount: number,
): AttachedCardFanLayout {
  const cardCount = Math.max(0, Math.floor(requestedCardCount))
  const maximumDistanceFromCenter = (cardCount - 1) / 2
  const cards = Array.from({ length: cardCount }, (_, index) => {
    const distanceFromCenter = index - maximumDistanceFromCenter
    const normalizedDistance =
      maximumDistanceFromCenter > 0
        ? Math.abs(distanceFromCenter) / maximumDistanceFromCenter
        : 0
    return {
      x:
        distanceFromCenter *
        attachedCardConfig.fan.cardCenterSpacingXPixels,
      y:
        normalizedDistance === 0
          ? 0
          : -normalizedDistance * attachedCardConfig.fan.outerCardLiftPixels,
      rotationRadians:
        distanceFromCenter *
        attachedCardConfig.fan.cardRotationStepRadians,
      drawOrder: index,
    }
  })

  return {
    x: attachedCardConfig.fan.offsetXPixels,
    y: attachedCardConfig.fan.offsetYPixels,
    rotationRadians: attachedCardConfig.fan.clockwiseRotationRadians,
    cards,
  }
}

export function attachedCardFanContainsPoint(
  x: number,
  y: number,
  fan: AttachedCardFanLayout,
): boolean {
  const fanLocal = rotateIntoLocalSpace(
    x - fan.x,
    y - fan.y,
    fan.rotationRadians,
  )
  const halfWidth = attachedCardConfig.card.displayWidthPixels / 2
  const halfHeight = attachedCardConfig.card.displayHeightPixels / 2

  return fan.cards.some((card) => {
    const cardLocal = rotateIntoLocalSpace(
      fanLocal.x - card.x,
      fanLocal.y - card.y,
      card.rotationRadians,
    )
    return (
      Math.abs(cardLocal.x) <= halfWidth &&
      Math.abs(cardLocal.y) <= halfHeight
    )
  })
}

function rotateIntoLocalSpace(
  x: number,
  y: number,
  rotationRadians: number,
): { x: number; y: number } {
  const cosine = Math.cos(rotationRadians)
  const sine = Math.sin(rotationRadians)
  return {
    x: x * cosine + y * sine,
    y: -x * sine + y * cosine,
  }
}
