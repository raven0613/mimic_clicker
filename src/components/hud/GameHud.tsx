import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import '../equipment/EquipmentInventory.scss'
import goldCoinImageUrl from '../../assets/coin/gold_coin_idle.png'
import { jackpotConfig } from '../../configs/jackpotConfig'
import { roundConfig } from '../../configs/roundConfig'
import type { HudSnapshot } from '../../store/gameStore'
import { BackpackPanel } from '../equipment/BackpackPanel'
import { EquipmentCardVisual } from '../equipment/EquipmentCard'
import {
  EquipmentTooltip,
  type EquipmentTooltipState,
} from '../equipment/EquipmentTooltip'
import { useEquipmentInteraction } from '../equipment/useEquipmentInteraction'
import { sortEquipmentInstances } from '../../service/game/equipment/equipmentInventory'
import type {
  EquipmentInventorySnapshot,
  EquipmentInstance,
  MoveEquipmentCommand,
} from '../../service/game/equipment/equipmentState'
import type { RuntimeMoveEquipmentResult } from '../../service/game/runtimeTypes'
import {
  loadBackpackSortMode,
  saveBackpackSortMode,
} from '../../service/preferences/backpackSortPreference'
import type { Vector2 } from '../../types/game'
import type { EquipmentCollectionTargets } from '../../types/game'
import { EquipmentHud } from './EquipmentHud'
import { RollingGoldCounter } from './RollingGoldCounter'
import { TimerBar } from './TimerBar'

interface GameHudProps {
  hud: HudSnapshot
  equipment: EquipmentInventorySnapshot
  isBackpackOpen: boolean
  onGoldTargetChange: (target: Vector2 | null) => void
  onEquipmentTargetsChange: (targets: EquipmentCollectionTargets) => void
  onToggleBackpack: () => void
  onCloseBackpack: () => void
  onMoveEquipment: (
    command: MoveEquipmentCommand,
  ) => RuntimeMoveEquipmentResult | undefined
}

export function GameHud({
  hud,
  equipment,
  isBackpackOpen,
  onGoldTargetChange,
  onEquipmentTargetsChange,
  onToggleBackpack,
  onCloseBackpack,
  onMoveEquipment,
}: GameHudProps) {
  const goldTargetRef = useRef<HTMLImageElement>(null)
  const [sortMode, setSortMode] = useState(loadBackpackSortMode)
  const [tooltip, setTooltip] = useState<EquipmentTooltipState | null>(null)
  const interaction = useEquipmentInteraction({
    snapshot: equipment,
    enabled: isBackpackOpen,
    onMove: onMoveEquipment,
  })
  const { cancelActiveInteraction } = interaction

  useLayoutEffect(() => {
    const goldTarget = goldTargetRef.current
    if (!goldTarget) return

    const reportTarget = () => {
      const bounds = goldTarget.getBoundingClientRect()
      onGoldTargetChange({
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2,
      })
    }
    reportTarget()
    const resizeObserver = new ResizeObserver(reportTarget)
    resizeObserver.observe(goldTarget)
    window.addEventListener('resize', reportTarget)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', reportTarget)
      onGoldTargetChange(null)
    }
  }, [onGoldTargetChange])

  const closeBackpack = () => {
    cancelActiveInteraction()
    setTooltip(null)
    onCloseBackpack()
  }

  useEffect(() => {
    if (!isBackpackOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setTooltip(null)
      if (!cancelActiveInteraction()) onCloseBackpack()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cancelActiveInteraction, isBackpackOpen, onCloseBackpack])

  const showTooltip = (instance: EquipmentInstance, element: HTMLElement) => {
    if (interaction.dragState) return
    const bounds = element.getBoundingClientRect()
    setTooltip({
      instance,
      anchor: {
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        left: bounds.left,
      },
    })
  }
  const hideTooltip = (instanceId: number) => {
    setTooltip((current) =>
      current?.instance.instanceId === instanceId ? null : current,
    )
  }
  const changeSortMode = (mode: typeof sortMode) => {
    setSortMode(mode)
    saveBackpackSortMode(mode)
  }
  const draggedInstance = findEquipmentInstance(
    equipment,
    interaction.draggedInstanceId,
  )
  const hoveredSlotIndex =
    interaction.hoveredDestination?.type === 'slot'
      ? interaction.hoveredDestination.slotIndex
      : null

  return (
    <div className="hud">
      <div className="hud__top">
        <TimerBar
          label="ROUND"
          remainingMs={hud.mainRemainingMs}
          durationMs={roundConfig.durationMs}
          variant="main"
        />
        {hud.jackpotRemainingMs !== null && (
          <TimerBar
            label="JACKPOT ESCAPE"
            remainingMs={hud.jackpotRemainingMs}
            durationMs={jackpotConfig.chaseDurationMs}
            variant="jackpot"
          />
        )}
      </div>
      <div className="hud__stats">
        <span className="hud__stat hud__gold">
          <img
            className="hud__gold-target"
            src={goldCoinImageUrl}
            alt=""
            ref={goldTargetRef}
          />
          <span className="hud__stat-label">Gold</span>
          <RollingGoldCounter value={hud.presentedRoundGold} />
        </span>
        <span className="hud__stat">
          <span className="hud__stat-label">Breaks</span>
          {hud.defeatedMimics}
        </span>
      </div>
      <EquipmentHud
        slotCount={equipment.slots.length}
        equipment={equipment}
        isBackpackOpen={isBackpackOpen}
        selectedInstanceId={interaction.selectedInstanceId}
        onTargetsChange={onEquipmentTargetsChange}
        onToggleBackpack={isBackpackOpen ? closeBackpack : onToggleBackpack}
        onSlotActivate={interaction.handleSlotActivate}
        onInstancePointerDown={interaction.handleInstancePointerDown}
        onShowTooltip={showTooltip}
        onHideTooltip={hideTooltip}
        isSlotDropActive={interaction.isSlotDropActive}
        hoveredSlotIndex={hoveredSlotIndex}
      />
      {isBackpackOpen && (
        <BackpackPanel
          instances={sortEquipmentInstances(equipment.stored, sortMode)}
          sortMode={sortMode}
          selectedInstanceId={interaction.selectedInstanceId}
          onSortModeChange={changeSortMode}
          onClose={closeBackpack}
          onBackpackActivate={interaction.handleBackpackActivate}
          onInstanceClick={interaction.handleInstanceClick}
          onInstancePointerDown={interaction.handleInstancePointerDown}
          onShowTooltip={showTooltip}
          onHideTooltip={hideTooltip}
          backpackDropActive={interaction.isBackpackDropActive}
          backpackDropHovered={
            interaction.isBackpackDropActive &&
            interaction.hoveredDestination?.type === 'backpack'
          }
        />
      )}
      {draggedInstance && interaction.dragState && (
        <div
          className="equipment-drag-preview"
          style={{
            left: interaction.dragState.x,
            top: interaction.dragState.y,
          }}
          aria-hidden="true"
        >
          <EquipmentCardVisual instance={draggedInstance} />
        </div>
      )}
      {tooltip && !interaction.dragState && <EquipmentTooltip state={tooltip} />}
    </div>
  )
}

function findEquipmentInstance(
  equipment: EquipmentInventorySnapshot,
  instanceId: number | null,
): EquipmentInstance | null {
  if (instanceId === null) return null
  for (const slot of equipment.slots) {
    if (
      slot.status === 'equipped' &&
      slot.instance.instanceId === instanceId
    ) {
      return slot.instance
    }
  }
  return (
    equipment.stored.find((instance) => instance.instanceId === instanceId) ??
    null
  )
}
