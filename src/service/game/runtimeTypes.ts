import type { Container, Sprite, Texture } from 'pixi.js'

import type { MimicId, RoundResult, Vector2 } from '../../types/game'
import type { EquipmentId } from '../../configs/equipmentConfig'
import type { HudSnapshot } from '../../store/gameStore'
import type { JackpotLifecycle } from '../combat/combat'
import type { MimicCrackVisual } from './damage/mimicCrackVisual'
import type {
  AttachedCardAttachment,
  RuntimeAttachedCardFan,
} from './attachedCards/attachedCardVisual'

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
  runtimeId: number
  mimicId: MimicId
  role: 'regular' | 'jackpotDisguise' | 'jackpot'
  container: Container
  visualContainer: Container
  sprite: Sprite
  flashSprite: Sprite
  health: number | null
  maximumHealth: number | null
  crackVisual: MimicCrackVisual | null
  logicalX: number
  logicalY: number
  downwardSpeedPixelsPerSecond: number
  hitAnimationRemainingMs: number
  refillEntranceElapsedMs: number | null
  nextWeaponDamageAllowedAtMs: number
  jackpotLifecycle: JackpotLifecycle | null
  jackpotVelocity: Vector2
  attachedCardFan: RuntimeAttachedCardFan | null
  attachedCards: AttachedCardAttachment[]
  hiddenEquipmentId: EquipmentId | null
}

export interface AnimatedEffect {
  container: Container
  elapsedMs: number
  durationMs: number
  velocity: Vector2
  gravityPixelsPerSecondSquared: number
  rotationSpeedRadiansPerSecond: number
}
