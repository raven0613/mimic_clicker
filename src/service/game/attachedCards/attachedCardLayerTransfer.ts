import type { Container } from 'pixi.js'

export function moveAttachedCardDisplayToLayer(
  display: Container,
  destination: Container,
): void {
  const worldPosition = display.getGlobalPosition()
  const worldRotation = getWorldRotation(display)
  const destinationWorldRotation = getWorldRotation(destination)
  const destinationPosition = destination.toLocal(worldPosition)

  destination.addChild(display)
  display.position.copyFrom(destinationPosition)
  display.rotation = worldRotation - destinationWorldRotation
  display.scale.set(1)
}

function getWorldRotation(display: Container): number {
  let rotation = 0
  let current: Container | null = display
  while (current) {
    rotation += current.rotation
    current = current.parent
  }
  return rotation
}
