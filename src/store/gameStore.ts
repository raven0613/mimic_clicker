import { create } from 'zustand'

import type { JackpotOutcome, ProgressData, RoundResult } from '../types/game'
import { createInitialProgress } from '../service/progression/createInitialProgress'
import type { EquipmentInventorySnapshot } from '../service/game/equipment/equipmentState'

export interface HudSnapshot {
  mainRemainingMs: number
  jackpotRemainingMs: number | null
  roundGold: number
  presentedRoundGold: number
  defeatedMimics: number
  jackpotOutcome: JackpotOutcome | null
}

interface GameStore {
  progress: ProgressData
  hud: HudSnapshot
  equipment: EquipmentInventorySnapshot
  latestRoundResult: RoundResult | null
  hydrateProgress: (progress: ProgressData) => void
  updateHud: (snapshot: HudSnapshot) => void
  updateEquipment: (snapshot: EquipmentInventorySnapshot) => void
  setLatestRoundResult: (result: RoundResult | null) => void
}

export const initialHudSnapshot: HudSnapshot = {
  mainRemainingMs: 0,
  jackpotRemainingMs: null,
  roundGold: 0,
  presentedRoundGold: 0,
  defeatedMimics: 0,
  jackpotOutcome: null,
}

export const initialEquipmentSnapshot: EquipmentInventorySnapshot = {
  slots: [],
  stored: [],
}

export const useGameStore = create<GameStore>((set) => ({
  progress: createInitialProgress(),
  hud: initialHudSnapshot,
  equipment: initialEquipmentSnapshot,
  latestRoundResult: null,
  hydrateProgress: (progress) => set({ progress }),
  updateHud: (hud) => set({ hud }),
  updateEquipment: (equipment) => set({ equipment }),
  setLatestRoundResult: (latestRoundResult) => set({ latestRoundResult }),
}))
