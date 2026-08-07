import type { Container, Sprite, Texture } from 'pixi.js'

import type { MimicId, RoundResult, Vector2 } from '../../types/game'
import type { HudSnapshot } from '../../store/gameStore'
import type { JackpotLifecycle } from '../combat/combat'

export interface RuntimeCallbacks {
  onHudSnapshot: (snapshot: HudSnapshot) => void
  onJackpotDisguised: () => void
  onJackpotWaitingToReturn: () => void
  onJackpotRevealed: () => void
  onJackpotResolved: () => void
  onRoundFinishing: () => void
  onRoundCompleted: (result: RoundResult) => void
}

export interface LoadedMimicTextures {
  normal: Texture
  rare1: Texture
  rare2: Texture
  jackpot: Texture
}

export interface RuntimeMimicEntity {
  mimicId: MimicId
  role: 'regular' | 'jackpotDisguise' | 'jackpot'
  container: Container
  sprite: Sprite
  flashSprite: Sprite
  health: number | null
  logicalX: number
  logicalY: number
  downwardSpeedPixelsPerSecond: number
  hitAnimationRemainingMs: number
  jackpotLifecycle: JackpotLifecycle | null
  jackpotVelocity: Vector2
}

export interface AnimatedEffect {
  container: Container
  elapsedMs: number
  durationMs: number
  velocity: Vector2
  gravityPixelsPerSecondSquared: number
  rotationSpeedRadiansPerSecond: number
}
