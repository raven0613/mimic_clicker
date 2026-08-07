import { create } from 'zustand'

import type { JackpotOutcome, ProgressData, RoundResult } from '../types/game'
import { createInitialProgress } from '../service/progression/createInitialProgress'

export interface HudSnapshot {
  mainRemainingMs: number
  jackpotRemainingMs: number | null
  roundGold: number
  defeatedMimics: number
  jackpotOutcome: JackpotOutcome | null
}

interface GameStore {
  progress: ProgressData
  hud: HudSnapshot
  latestRoundResult: RoundResult | null
  hydrateProgress: (progress: ProgressData) => void
  updateHud: (snapshot: HudSnapshot) => void
  setLatestRoundResult: (result: RoundResult | null) => void
}

export const initialHudSnapshot: HudSnapshot = {
  mainRemainingMs: 0,
  jackpotRemainingMs: null,
  roundGold: 0,
  defeatedMimics: 0,
  jackpotOutcome: null,
}

export const useGameStore = create<GameStore>((set) => ({
  progress: createInitialProgress(),
  hud: initialHudSnapshot,
  latestRoundResult: null,
  hydrateProgress: (progress) => set({ progress }),
  updateHud: (hud) => set({ hud }),
  setLatestRoundResult: (latestRoundResult) => set({ latestRoundResult }),
}))
