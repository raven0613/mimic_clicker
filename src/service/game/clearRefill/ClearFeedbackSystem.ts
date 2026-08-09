import { Text, type Container } from 'pixi.js'

import { clearFeedbackConfig } from '../../../configs/clearRefillConfig'

export class ClearFeedbackSystem {
  private readonly text: Text
  private readonly getFieldSize: () => { width: number; height: number }
  private elapsedMs: number | null = null

  public constructor(
    stage: Container,
    getFieldSize: () => { width: number; height: number },
  ) {
    this.getFieldSize = getFieldSize
    this.text = new Text({
      text: clearFeedbackConfig.messageText,
      style: {
        fontFamily: clearFeedbackConfig.fontFamily,
        fontSize: clearFeedbackConfig.fontSizePixels,
        fontWeight: '900',
        fill: clearFeedbackConfig.fillColor,
        stroke: {
          color: clearFeedbackConfig.strokeColor,
          width: clearFeedbackConfig.strokeWidthPixels,
        },
      },
      anchor: 0.5,
      eventMode: 'none',
      roundPixels: true,
      visible: false,
    })
    stage.addChild(this.text)
  }

  public show(): void {
    this.elapsedMs = 0
    this.text.visible = true
    this.syncVisual()
  }

  public update(deltaMs: number): void {
    if (this.elapsedMs === null) return
    this.elapsedMs += Math.max(0, deltaMs)
    if (this.elapsedMs >= clearFeedbackConfig.displayDurationMs) {
      this.clear()
      return
    }
    this.syncVisual()
  }

  public clear(): void {
    this.elapsedMs = null
    this.text.visible = false
  }

  public destroy(): void {
    this.text.removeFromParent()
    this.text.destroy()
  }

  private syncVisual(): void {
    const elapsedMs = this.elapsedMs ?? 0
    const field = this.getFieldSize()
    const progress = Math.min(
      1,
      elapsedMs / clearFeedbackConfig.displayDurationMs,
    )
    const entranceProgress = Math.min(
      1,
      elapsedMs / clearFeedbackConfig.entranceDurationMs,
    )
    const fadeStartMs =
      clearFeedbackConfig.displayDurationMs -
      clearFeedbackConfig.fadeOutDurationMs
    const fadeProgress = Math.max(
      0,
      (elapsedMs - fadeStartMs) / clearFeedbackConfig.fadeOutDurationMs,
    )
    const scale =
      clearFeedbackConfig.initialScale +
      (clearFeedbackConfig.settledScale -
        clearFeedbackConfig.initialScale) *
        entranceProgress

    this.text.position.set(
      field.width / 2,
      field.height * clearFeedbackConfig.verticalPositionRatio -
        clearFeedbackConfig.riseDistancePixels * progress,
    )
    this.text.scale.set(scale)
    this.text.alpha = 1 - Math.min(1, fadeProgress)
  }
}
