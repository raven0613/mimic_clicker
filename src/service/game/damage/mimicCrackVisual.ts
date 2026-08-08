import { Graphics, GraphicsContext } from 'pixi.js'

import {
  mimicDamageVisualConfig,
  type MimicCrackPath,
  type MimicCrackPattern,
} from '../../../configs/mimicDamageVisualConfig'
import { spawnConfig } from '../../../configs/spawnConfig'
import type { MimicCrackStage } from './mimicCrackStage'

interface CrackStageContexts {
  subtle: GraphicsContext
  severe: GraphicsContext
}

export interface MimicCrackVisual {
  graphics: Graphics
  patternIndex: number
  stage: MimicCrackStage
}

interface CrackStrokeStyle {
  color: number
  alpha: number
  width: number
}

const crackStageContexts = mimicDamageVisualConfig.patterns.map(
  createCrackStageContexts,
)

function createCrackStageContexts(
  pattern: MimicCrackPattern,
): CrackStageContexts {
  const subtleContext = new GraphicsContext()
  drawSubtleCracks(subtleContext, pattern.subtlePaths)

  const severeContext = new GraphicsContext()
  drawSevereCracks(severeContext, [
    ...pattern.subtlePaths,
    ...pattern.severeExtensionPaths,
  ])

  return { subtle: subtleContext, severe: severeContext }
}

function drawSubtleCracks(
  context: GraphicsContext,
  paths: readonly MimicCrackPath[],
): void {
  const style = mimicDamageVisualConfig.subtleStyle
  drawCrackPaths(
    context,
    paths,
    -style.highlightOffsetPixels,
    style.highlightOffsetPixels,
    {
      color: style.highlightColor,
      alpha: style.highlightAlpha,
      width: style.highlightWidthPixels,
    },
  )
  drawCrackPaths(context, paths, 0, 0, {
    color: style.darkColor,
    alpha: style.darkAlpha,
    width: style.darkWidthPixels,
  })
}

function drawSevereCracks(
  context: GraphicsContext,
  paths: readonly MimicCrackPath[],
): void {
  const style = mimicDamageVisualConfig.severeStyle
  const edgeOffset = style.maximumEdgeOffsetPixels / Math.SQRT2
  drawCrackPaths(context, paths, -edgeOffset, edgeOffset, {
    color: style.highlightColor,
    alpha: style.highlightAlpha,
    width: style.highlightWidthPixels,
  })
  drawCrackPaths(context, paths, 0, 0, {
    color: style.darkColor,
    alpha: style.darkAlpha,
    width: style.darkWidthPixels,
  })
}

function drawCrackPaths(
  context: GraphicsContext,
  paths: readonly MimicCrackPath[],
  offsetX: number,
  offsetY: number,
  strokeStyle: CrackStrokeStyle,
): void {
  for (const path of paths) {
    const firstPoint = path[0]
    if (!firstPoint || path.length < 2) continue

    context.moveTo(
      firstPoint.xRatio * spawnConfig.cardWidthPixels + offsetX,
      firstPoint.yRatio * spawnConfig.cardHeightPixels + offsetY,
    )
    for (let pointIndex = 1; pointIndex < path.length; pointIndex += 1) {
      const point = path[pointIndex]
      if (!point) continue
      context.lineTo(
        point.xRatio * spawnConfig.cardWidthPixels + offsetX,
        point.yRatio * spawnConfig.cardHeightPixels + offsetY,
      )
    }
    context.stroke({
      ...strokeStyle,
      cap: 'round',
      join: 'round',
    })
  }
}

export function createMimicCrackVisual(
  horizontalSpawnPositionPixels: number,
): MimicCrackVisual {
  const horizontalCardIndex = Math.floor(
    Math.abs(horizontalSpawnPositionPixels) / spawnConfig.cardWidthPixels,
  )
  const patternIndex = horizontalCardIndex % crackStageContexts.length
  const graphics = new Graphics({
    context: crackStageContexts[patternIndex].subtle,
    eventMode: 'none',
  })
  graphics.visible = false

  return {
    graphics,
    patternIndex,
    stage: 'intact',
  }
}

export function updateMimicCrackVisual(
  visual: MimicCrackVisual | null,
  stage: MimicCrackStage,
): void {
  if (!visual || visual.stage === stage) return

  visual.stage = stage
  if (stage === 'intact' || stage === 'destroyed') {
    visual.graphics.visible = false
    return
  }

  visual.graphics.context = crackStageContexts[visual.patternIndex][stage]
  visual.graphics.visible = true
}
