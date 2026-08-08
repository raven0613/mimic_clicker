import { Container, Graphics, Sprite, type Texture } from 'pixi.js'

import { animationConfig } from '../../../configs/animationConfig'
import type { RandomSource } from '../../../types/game'
import type { AnimatedEffect } from '../runtimeTypes'

function randomBetween(
  minimum: number,
  maximum: number,
  random: RandomSource,
): number {
  return minimum + (maximum - minimum) * random()
}

export function createShatterEffects(
  texture: Texture,
  x: number,
  y: number,
  width: number,
  height: number,
  random: RandomSource,
): AnimatedEffect[] {
  const effects: AnimatedEffect[] = []
  const sliceWidth = width / animationConfig.shatter.columns
  const sliceHeight = height / animationConfig.shatter.rows

  for (let row = 0; row < animationConfig.shatter.rows; row += 1) {
    for (let column = 0; column < animationConfig.shatter.columns; column += 1) {
      const offsetX = (column + 0.5) * sliceWidth - width / 2
      const offsetY = (row + 0.5) * sliceHeight - height / 2
      const shard = new Container()
      shard.position.set(x + offsetX, y + offsetY)

      const sprite = new Sprite({ texture, anchor: 0.5 })
      sprite.setSize(width, height)
      sprite.position.set(-offsetX, -offsetY)
      const mask = new Graphics()
        .rect(-sliceWidth / 2, -sliceHeight / 2, sliceWidth, sliceHeight)
        .fill(0xffffff)
      sprite.mask = mask
      shard.addChild(sprite, mask)

      const horizontalDirection = column === 0 ? -1 : 1
      effects.push({
        container: shard,
        elapsedMs: 0,
        durationMs: animationConfig.shatter.durationMs,
        velocity: {
          x:
            horizontalDirection *
            randomBetween(
              animationConfig.shatter.minimumHorizontalSpeedPixelsPerSecond,
              animationConfig.shatter.maximumHorizontalSpeedPixelsPerSecond,
              random,
            ),
          y: -randomBetween(
            animationConfig.shatter.minimumUpwardSpeedPixelsPerSecond,
            animationConfig.shatter.maximumUpwardSpeedPixelsPerSecond,
            random,
          ),
        },
        gravityPixelsPerSecondSquared:
          animationConfig.shatter.gravityPixelsPerSecondSquared,
        rotationSpeedRadiansPerSecond:
          (random() * 2 - 1) *
          animationConfig.shatter.maximumRotationSpeedRadiansPerSecond,
      })
    }
  }

  return effects
}

export function updateAnimatedEffect(
  effect: AnimatedEffect,
  deltaMs: number,
): boolean {
  effect.elapsedMs += deltaMs
  const deltaSeconds = deltaMs / 1_000
  effect.velocity.y += effect.gravityPixelsPerSecondSquared * deltaSeconds
  effect.container.x += effect.velocity.x * deltaSeconds
  effect.container.y += effect.velocity.y * deltaSeconds
  effect.container.rotation +=
    effect.rotationSpeedRadiansPerSecond * deltaSeconds
  const progress = Math.min(1, effect.elapsedMs / effect.durationMs)
  effect.container.alpha = 1 - progress * progress
  return progress >= 1
}
