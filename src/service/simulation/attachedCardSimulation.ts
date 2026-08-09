import { attachedCardConfig } from '../../configs/attachedCardConfig'
import type { EquipmentId } from '../../configs/equipmentConfig'
import type { MimicId, RandomSource } from '../../types/game'
import {
  selectAttachedCardAssignments,
  selectHiddenEquipmentId,
  selectJackpotAttachedCardAssignments,
  type EffectCardId,
} from '../game/attachedCards/attachedCardRules'

export interface SimulatedAttachedContent {
  effectCardIds: EffectCardId[]
  visibleEquipmentIds: EquipmentId[]
  hiddenEquipmentId: EquipmentId | null
}

export function selectSimulatedAttachedContent(
  mimicId: MimicId,
  random: RandomSource,
): SimulatedAttachedContent {
  const assignments = selectAttachedCardAssignments({
    decorative: false,
    maximumCount: attachedCardConfig.capacity.byMimic[mimicId],
    random,
  })
  return splitAssignments(assignments, random)
}

export function selectSimulatedJackpotAttachedContent(
  random: RandomSource,
): SimulatedAttachedContent {
  return splitAssignments(selectJackpotAttachedCardAssignments(random), random)
}

function splitAssignments(
  assignments: ReturnType<typeof selectAttachedCardAssignments>,
  random: RandomSource,
): SimulatedAttachedContent {
  const visibleEquipmentIds = assignments
    .filter((assignment) => assignment.kind === 'equipment')
    .map(({ id }) => id)
  return {
    effectCardIds: assignments
      .filter((assignment) => assignment.kind === 'effect')
      .map(({ id }) => id),
    visibleEquipmentIds,
    hiddenEquipmentId: selectHiddenEquipmentId(
      false,
      visibleEquipmentIds,
      random,
    ),
  }
}
