import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import type {
  EquipmentDestination,
  EquipmentInventorySnapshot,
  MoveEquipmentCommand,
} from '../../service/game/equipment/equipmentState'
import {
  shouldCommitEquipmentDrop,
  type EquipmentPointerEndReason,
} from './equipmentPointerCompletion'

interface PointerSession {
  pointerId: number
  instanceId: number
  startX: number
  startY: number
  dragging: boolean
  sourceElement: HTMLElement
}

export interface EquipmentDragState {
  instanceId: number
  x: number
  y: number
}

interface UseEquipmentInteractionInput {
  snapshot: EquipmentInventorySnapshot
  enabled: boolean
  onMove: (
    command: MoveEquipmentCommand,
  ) => { status: 'moved' | 'rejected' } | undefined
}

const dragStartDistancePixels = 6

export function useEquipmentInteraction({
  snapshot,
  enabled,
  onMove,
}: UseEquipmentInteractionInput) {
  const [selectedInstanceId, setSelectedInstanceId] = useState<number | null>(
    null,
  )
  const [dragState, setDragState] = useState<EquipmentDragState | null>(null)
  const [hoveredDestination, setHoveredDestination] =
    useState<EquipmentDestination | null>(null)
  const [trackingPointer, setTrackingPointer] = useState(false)
  const pointerSession = useRef<PointerSession | null>(null)
  const suppressClickUntil = useRef({ instanceId: -1, time: 0 })
  const snapshotRef = useRef(snapshot)
  const onMoveRef = useRef(onMove)

  useEffect(() => {
    snapshotRef.current = snapshot
  }, [snapshot])

  useEffect(() => {
    onMoveRef.current = onMove
  }, [onMove])

  const commitMove = useCallback(
    (instanceId: number, destination: EquipmentDestination): boolean => {
      if (!isDestinationAvailable(snapshotRef.current, instanceId, destination)) {
        return false
      }
      const result = onMoveRef.current({ instanceId, destination })
      if (result?.status !== 'moved') return false
      setSelectedInstanceId(null)
      return true
    },
    [],
  )

  useEffect(() => {
    if (!trackingPointer) return

    const handlePointerMove = (event: PointerEvent) => {
      const session = pointerSession.current
      if (!session || session.pointerId !== event.pointerId) return
      const distance = Math.hypot(
        event.clientX - session.startX,
        event.clientY - session.startY,
      )
      if (!session.dragging && distance < dragStartDistancePixels) return
      session.dragging = true
      event.preventDefault()
      setDragState({
        instanceId: session.instanceId,
        x: event.clientX,
        y: event.clientY,
      })
      setHoveredDestination(
        getDestinationAtPoint(event.clientX, event.clientY),
      )
    }

    const finishPointer = (
      event: PointerEvent,
      endReason: EquipmentPointerEndReason,
    ) => {
      const session = pointerSession.current
      if (!session || session.pointerId !== event.pointerId) return
      const destination =
        endReason === 'released'
          ? getDestinationAtPoint(event.clientX, event.clientY)
          : null
      if (shouldCommitEquipmentDrop(endReason, session.dragging, destination)) {
        commitMove(session.instanceId, destination)
      }
      if (session.dragging) {
        suppressClickUntil.current = {
          instanceId: session.instanceId,
          time: performance.now() + 100,
        }
      }
      if (endReason === 'cancelled') setSelectedInstanceId(null)
      releaseCapturedPointer(session)
      pointerSession.current = null
      setDragState(null)
      setHoveredDestination(null)
      setTrackingPointer(false)
    }

    const handlePointerUp = (event: PointerEvent) =>
      finishPointer(event, 'released')
    const handlePointerCancel = (event: PointerEvent) =>
      finishPointer(event, 'cancelled')

    window.addEventListener('pointermove', handlePointerMove, {
      passive: false,
    })
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
    }
  }, [commitMove, trackingPointer])

  const handleInstancePointerDown = useCallback(
    (instanceId: number, event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || event.button !== 0) return
      event.currentTarget.setPointerCapture(event.pointerId)
      pointerSession.current = {
        pointerId: event.pointerId,
        instanceId,
        startX: event.clientX,
        startY: event.clientY,
        dragging: false,
        sourceElement: event.currentTarget,
      }
      setTrackingPointer(true)
    },
    [enabled],
  )

  const handleInstanceClick = useCallback((instanceId: number) => {
    const suppressed = suppressClickUntil.current
    if (suppressed.instanceId === instanceId && performance.now() < suppressed.time) {
      return
    }
    setSelectedInstanceId((current) =>
      current === instanceId ? null : instanceId,
    )
  }, [])

  const handleSlotActivate = useCallback(
    (slotIndex: number) => {
      if (!enabled) return
      const slotInstance =
        snapshot.slots[slotIndex]?.status === 'equipped'
          ? snapshot.slots[slotIndex].instance.instanceId
          : null
      const suppressed = suppressClickUntil.current
      if (
        slotInstance === suppressed.instanceId &&
        performance.now() < suppressed.time
      ) {
        return
      }
      if (selectedInstanceId !== null) {
        commitMove(selectedInstanceId, { type: 'slot', slotIndex })
        return
      }
      const slot = snapshot.slots[slotIndex]
      if (slot?.status === 'equipped') {
        setSelectedInstanceId(slot.instance.instanceId)
      }
    },
    [commitMove, enabled, selectedInstanceId, snapshot.slots],
  )

  const handleBackpackActivate = useCallback(() => {
    if (selectedInstanceId === null) return
    commitMove(selectedInstanceId, { type: 'backpack' })
  }, [commitMove, selectedInstanceId])

  const cancelActiveInteraction = useCallback((): boolean => {
    const hadInteraction =
      pointerSession.current !== null || selectedInstanceId !== null
    if (pointerSession.current) {
      releaseCapturedPointer(pointerSession.current)
    }
    pointerSession.current = null
    setTrackingPointer(false)
    setDragState(null)
    setHoveredDestination(null)
    setSelectedInstanceId(null)
    return hadInteraction
  }, [selectedInstanceId])

  const draggedInstanceId = dragState?.instanceId ?? null
  return {
    selectedInstanceId,
    dragState,
    hoveredDestination,
    draggedInstanceId,
    handleInstancePointerDown,
    handleInstanceClick,
    handleSlotActivate,
    handleBackpackActivate,
    cancelActiveInteraction,
    isSlotDropActive: (slotIndex: number) =>
      draggedInstanceId !== null &&
      isDestinationAvailable(snapshot, draggedInstanceId, {
        type: 'slot',
        slotIndex,
      }),
    isBackpackDropActive:
      draggedInstanceId !== null &&
      isDestinationAvailable(snapshot, draggedInstanceId, {
        type: 'backpack',
      }),
  }
}

function releaseCapturedPointer(session: PointerSession): void {
  if (session.sourceElement.hasPointerCapture(session.pointerId)) {
    session.sourceElement.releasePointerCapture(session.pointerId)
  }
}

function isDestinationAvailable(
  snapshot: EquipmentInventorySnapshot,
  instanceId: number,
  destination: EquipmentDestination,
): boolean {
  const sourceSlotIndex = snapshot.slots.findIndex(
    (slot) =>
      slot.status === 'equipped' && slot.instance.instanceId === instanceId,
  )
  const isStored = snapshot.stored.some(
    (instance) => instance.instanceId === instanceId,
  )
  if (sourceSlotIndex < 0 && !isStored) return false
  if (destination.type === 'backpack') return sourceSlotIndex >= 0
  const slot = snapshot.slots[destination.slotIndex]
  return Boolean(
    slot && slot.status !== 'reserved' && sourceSlotIndex !== destination.slotIndex,
  )
}

function getDestinationAtPoint(
  clientX: number,
  clientY: number,
): EquipmentDestination | null {
  const element = document
    .elementFromPoint(clientX, clientY)
    ?.closest<HTMLElement>('[data-equipment-drop-target]')
  if (!element) return null
  if (element.dataset.equipmentDropTarget === 'backpack') {
    return { type: 'backpack' }
  }
  const slotIndex = Number(element.dataset.equipmentSlotIndex)
  return Number.isInteger(slotIndex) ? { type: 'slot', slotIndex } : null
}
