import type { Container } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'

import { clearFeedbackConfig } from '../../../configs/clearRefillConfig'
import type { RuntimeMimicEntity } from '../runtimeTypes'
import {
  calculateRefillEntranceScale,
  initializeRefillEntranceAnimation,
  updateRefillEntranceAnimation,
} from './refillEntranceAnimation'

describe('refill entrance animation', () => {
  it('initializes only refill entities at the configured zero scale', () => {
    const animation = clearFeedbackConfig.refillEntrance
    const animatedEntity = createVisualEntity()
    const immediateEntity = createVisualEntity()

    initializeRefillEntranceAnimation(animatedEntity, true)
    initializeRefillEntranceAnimation(immediateEntity, false)

    expect(animatedEntity.visualContainer.scale.set).toHaveBeenCalledWith(
      animation.initialScale,
    )
    expect(animatedEntity.refillEntranceElapsedMs).toBe(0)
    expect(immediateEntity.visualContainer.scale.set).toHaveBeenCalledWith(
      animation.settledScale,
    )
    expect(immediateEntity.refillEntranceElapsedMs).toBeNull()
  })

  it('grows from the configured initial scale to the peak scale', () => {
    const animation = clearFeedbackConfig.refillEntrance

    expect(calculateRefillEntranceScale(0)).toBe(animation.initialScale)
    expect(calculateRefillEntranceScale(animation.growDurationMs)).toBe(
      animation.peakScale,
    )
  })

  it('settles at the configured original scale and remains there', () => {
    const animation = clearFeedbackConfig.refillEntrance
    const totalDurationMs =
      animation.growDurationMs + animation.settleDurationMs

    expect(calculateRefillEntranceScale(totalDurationMs)).toBe(
      animation.settledScale,
    )
    expect(calculateRefillEntranceScale(totalDurationMs * 2)).toBe(
      animation.settledScale,
    )
  })

  it('stops updating after the visual reaches its settled scale', () => {
    const animation = clearFeedbackConfig.refillEntrance
    const entity = createVisualEntity()
    entity.refillEntranceElapsedMs = 0

    updateRefillEntranceAnimation(
      entity,
      animation.growDurationMs + animation.settleDurationMs,
    )

    expect(entity.visualContainer.scale.set).toHaveBeenCalledWith(
      animation.settledScale,
    )
    expect(entity.refillEntranceElapsedMs).toBeNull()

    updateRefillEntranceAnimation(entity, animation.growDurationMs)
    expect(entity.visualContainer.scale.set).toHaveBeenCalledOnce()
  })
})

function createVisualEntity(): RuntimeMimicEntity {
  return {
    visualContainer: {
      scale: { set: vi.fn() },
    } as unknown as Container,
    refillEntranceElapsedMs: null,
  } as RuntimeMimicEntity
}
