interface SpriteDisplaySize {
  width: number
  height: number
}

export function calculateSpriteDisplaySize(
  frameWidthPixels: number,
  frameHeightPixels: number,
  displayScale: number,
): SpriteDisplaySize {
  if (!Number.isFinite(displayScale) || displayScale <= 0) {
    throw new Error(
      `Display scale must be greater than zero, received ${displayScale}`,
    )
  }
  return {
    width: frameWidthPixels * displayScale,
    height: frameHeightPixels * displayScale,
  }
}
