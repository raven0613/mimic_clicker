import type { EffectCardId } from '../game/attachedCards/attachedCardRules'

export function countEffectCards(
  ids: readonly EffectCardId[],
): Record<EffectCardId, number> {
  return {
    thunder: ids.filter((id) => id === 'thunder').length,
    meteorite: ids.filter((id) => id === 'meteorite').length,
    tornado: ids.filter((id) => id === 'tornado').length,
  }
}

export function addEffectCounts(
  first: Record<EffectCardId, number>,
  second: Record<EffectCardId, number>,
): Record<EffectCardId, number> {
  return {
    thunder: first.thunder + second.thunder,
    meteorite: first.meteorite + second.meteorite,
    tornado: first.tornado + second.tornado,
  }
}
