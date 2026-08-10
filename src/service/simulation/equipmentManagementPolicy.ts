import { balanceSimulationConfig } from '../../configs/balanceSimulationConfig'
import type { EquipmentId } from '../../configs/equipmentConfig'
import type {
  EquipmentInstance,
  EquipmentSlotSnapshot,
} from '../game/equipment/equipmentState'
import { EquipmentState } from '../game/equipment/equipmentState'

export type BackpackManagementPolicyKey =
  keyof typeof balanceSimulationConfig.backpackManagementPolicies

export function applyEquipmentManagementPolicy(
  state: EquipmentState,
  policyKey: BackpackManagementPolicyKey,
): number {
  const priorities = new Map<EquipmentId, number>(
    balanceSimulationConfig.backpackManagementPolicies[
      policyKey
    ].prioritizedEquipmentIds.map((id, index) => [id, index]),
  )
  if (priorities.size === 0) return 0

  let switchCount = 0
  while (true) {
    const snapshot = state.getInventorySnapshot()
    const candidate = [...snapshot.stored]
      .filter(({ id }) => priorities.has(id))
      .sort((first, second) => compareCandidates(first, second, priorities))[0]
    if (!candidate) return switchCount

    const emptySlotIndex = snapshot.slots.findIndex(
      (slot) => slot.status === 'empty',
    )
    const destinationSlotIndex =
      emptySlotIndex >= 0
        ? emptySlotIndex
        : findLowerPrioritySlot(snapshot.slots, candidate, priorities)
    if (destinationSlotIndex < 0) return switchCount

    const result = state.moveEquipment({
      instanceId: candidate.instanceId,
      destination: { type: 'slot', slotIndex: destinationSlotIndex },
    })
    if (result.status !== 'moved') {
      throw new Error(
        `Management policy ${policyKey} could not move instance ${candidate.instanceId}: ${result.reason}`,
      )
    }
    switchCount += 1
  }
}

function compareCandidates(
  first: EquipmentInstance,
  second: EquipmentInstance,
  priorities: ReadonlyMap<EquipmentId, number>,
): number {
  return (
    getPriority(first.id, priorities) - getPriority(second.id, priorities) ||
    second.acquiredSequence - first.acquiredSequence
  )
}

function findLowerPrioritySlot(
  slots: readonly EquipmentSlotSnapshot[],
  candidate: EquipmentInstance,
  priorities: ReadonlyMap<EquipmentId, number>,
): number {
  const candidatePriority = getPriority(candidate.id, priorities)
  let destinationIndex = -1
  let lowestEquippedPriority = candidatePriority
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index]
    if (slot.status !== 'equipped') continue
    const equippedPriority = getPriority(slot.instance.id, priorities)
    if (equippedPriority <= lowestEquippedPriority) continue
    destinationIndex = index
    lowestEquippedPriority = equippedPriority
  }
  return destinationIndex
}

function getPriority(
  id: EquipmentId,
  priorities: ReadonlyMap<EquipmentId, number>,
): number {
  return priorities.get(id) ?? Number.POSITIVE_INFINITY
}
