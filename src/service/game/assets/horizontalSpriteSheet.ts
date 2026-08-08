export interface HorizontalSpriteSheetLayout {
  assetLabel?: string
  sourceWidthPixels: number
  sourceHeightPixels: number
  frameWidthPixels: number
  frameHeightPixels: number
  frameCount: number
}

export interface SpriteSheetFrameRectangle {
  x: number
  y: number
  width: number
  height: number
}

export function createHorizontalSpriteSheetFrameRectangles(
  sourceWidth: number,
  sourceHeight: number,
  layout: HorizontalSpriteSheetLayout,
): SpriteSheetFrameRectangle[] {
  const expectedStripWidth = layout.frameWidthPixels * layout.frameCount
  const isLayoutConsistent =
    expectedStripWidth === layout.sourceWidthPixels &&
    layout.frameHeightPixels === layout.sourceHeightPixels
  const dimensionsMatch =
    sourceWidth === layout.sourceWidthPixels &&
    sourceHeight === layout.sourceHeightPixels

  if (!isLayoutConsistent || !dimensionsMatch) {
    const assetLabel = layout.assetLabel ?? 'horizontal sprite sheet'
    throw new Error(
      `Invalid ${assetLabel} dimensions: expected ${layout.sourceWidthPixels}x${layout.sourceHeightPixels} as ${layout.frameCount} frames of ${layout.frameWidthPixels}x${layout.frameHeightPixels}, received ${sourceWidth}x${sourceHeight}`,
    )
  }

  return Array.from({ length: layout.frameCount }, (_, frameIndex) => ({
    x: frameIndex * layout.frameWidthPixels,
    y: 0,
    width: layout.frameWidthPixels,
    height: layout.frameHeightPixels,
  }))
}
