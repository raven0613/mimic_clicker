export const mimicIds = ['normal', 'rare1', 'rare2'] as const

export type MimicId = (typeof mimicIds)[number]

export type JackpotOutcome =
  | 'notRevealed'
  | 'defeated'
  | 'escaped'
  | 'roundExpiredDuringChase'

export interface RoundResult {
  earnedGold: number
  defeatedMimics: number
  jackpotOutcome: JackpotOutcome
}

export interface ProgressData {
  schemaVersion: 1
  completedRounds: number
  gold: number
  unlockedMimicIds: MimicId[]
  pendingUnlockMimicIds: MimicId[]
}

export interface RectangleBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface Vector2 {
  x: number
  y: number
}

export interface EquipmentCollectionTargets {
  slotTargets: Array<Vector2 | null>
  backpackTarget: Vector2 | null
}

export type RandomSource = () => number
