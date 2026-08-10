import {
  useLayoutEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import backpackImageUrl from '../../assets/equipment/backpack.png'
import { EquipmentCardVisual } from '../equipment/EquipmentCard'
import type {
  EquipmentInstance,
  EquipmentInventorySnapshot,
} from '../../service/game/equipment/equipmentState'
import { getEquipmentPresentation } from '../../service/game/equipment/equipmentPresentation'
import type { EquipmentCollectionTargets, Vector2 } from '../../types/game'

interface EquipmentHudProps {
  slotCount: number
  equipment: EquipmentInventorySnapshot
  isBackpackOpen: boolean
  selectedInstanceId: number | null
  onTargetsChange: (targets: EquipmentCollectionTargets) => void
  onToggleBackpack: () => void
  onSlotActivate: (slotIndex: number) => void
  onInstancePointerDown: (
    instanceId: number,
    event: ReactPointerEvent<HTMLElement>,
  ) => void
  onShowTooltip: (instance: EquipmentInstance, element: HTMLElement) => void
  onHideTooltip: (instanceId: number) => void
  isSlotDropActive: (slotIndex: number) => boolean
  hoveredSlotIndex: number | null
}

export function EquipmentHud({
  slotCount,
  equipment,
  isBackpackOpen,
  selectedInstanceId,
  onTargetsChange,
  onToggleBackpack,
  onSlotActivate,
  onInstancePointerDown,
  onShowTooltip,
  onHideTooltip,
  isSlotDropActive,
  hoveredSlotIndex,
}: EquipmentHudProps) {
  const slotRefs = useRef<Array<HTMLDivElement | null>>([])
  const backpackRef = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    const reportTargets = () => {
      onTargetsChange({
        slotTargets: Array.from(
          { length: slotCount },
          (_, slotIndex) => centerOf(slotRefs.current[slotIndex]),
        ),
        backpackTarget: centerOf(backpackRef.current),
      })
    }
    reportTargets()
    const resizeObserver = new ResizeObserver(reportTargets)
    for (const slot of slotRefs.current) {
      if (slot) resizeObserver.observe(slot)
    }
    if (backpackRef.current) resizeObserver.observe(backpackRef.current)
    window.addEventListener('resize', reportTargets)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', reportTargets)
      onTargetsChange({
        slotTargets: Array.from(
          { length: slotCount },
          () => null,
        ),
        backpackTarget: null,
      })
    }
  }, [onTargetsChange, slotCount])

  return (
    <div className="equipment-hud" aria-label="Equipment">
      <div className="equipment-hud__slots">
        {Array.from(
          { length: slotCount },
          (_, slotIndex) => (
            <EquipmentSlot
              slotIndex={slotIndex}
              slot={equipment.slots[slotIndex] ?? { status: 'empty' }}
              interactive={isBackpackOpen}
              selectedInstanceId={selectedInstanceId}
              dropActive={isSlotDropActive(slotIndex)}
              dropHovered={
                hoveredSlotIndex === slotIndex && isSlotDropActive(slotIndex)
              }
              onActivate={onSlotActivate}
              onInstancePointerDown={onInstancePointerDown}
              onShowTooltip={onShowTooltip}
              onHideTooltip={onHideTooltip}
              key={slotIndex}
              ref={(element) => {
                slotRefs.current[slotIndex] = element
              }}
            />
          ),
        )}
      </div>
      <button
        type="button"
        className="equipment-hud__backpack-frame"
        aria-label={isBackpackOpen ? '關閉背包' : '開啟背包'}
        aria-expanded={isBackpackOpen}
        aria-controls="backpack-panel"
        onClick={onToggleBackpack}
        ref={backpackRef}
      >
        <img
          className="equipment-hud__backpack"
          src={backpackImageUrl}
          alt=""
          draggable={false}
        />
        {equipment.stored.length > 0 && (
          <span className="equipment-hud__backpack-count">
            {equipment.stored.length}
          </span>
        )}
      </button>
    </div>
  )
}

interface EquipmentSlotProps {
  slotIndex: number
  slot: EquipmentInventorySnapshot['slots'][number]
  interactive: boolean
  selectedInstanceId: number | null
  dropActive: boolean
  dropHovered: boolean
  onActivate: (slotIndex: number) => void
  onInstancePointerDown: (
    instanceId: number,
    event: ReactPointerEvent<HTMLElement>,
  ) => void
  onShowTooltip: (instance: EquipmentInstance, element: HTMLElement) => void
  onHideTooltip: (instanceId: number) => void
  ref: (element: HTMLDivElement | null) => void
}

function EquipmentSlot({
  slotIndex,
  slot,
  interactive,
  selectedInstanceId,
  dropActive,
  dropHovered,
  onActivate,
  onInstancePointerDown,
  onShowTooltip,
  onHideTooltip,
  ref,
}: EquipmentSlotProps) {
  const instance = slot.status === 'equipped' ? slot.instance : null
  const presentation = instance
    ? getEquipmentPresentation(instance.id)
    : null
  const selected = instance?.instanceId === selectedInstanceId

  return (
    <div ref={ref} className="equipment-hud__slot-target">
      <button
        type="button"
        className={`equipment-hud__slot${
          selected ? ' equipment-hud__slot--selected' : ''
        }${dropActive ? ' equipment-hud__slot--drop-active' : ''}${
          dropHovered ? ' equipment-hud__slot--drop-hovered' : ''
        }${slot.status === 'reserved' ? ' equipment-hud__slot--reserved' : ''}`}
        data-equipment-drop-target="slot"
        data-equipment-slot-index={slotIndex}
        aria-label={
          instance && presentation
            ? `裝備槽 ${slotIndex + 1}：${presentation.displayName}，稀有度 ${instance.rarity}。${presentation.effectText}`
            : slot.status === 'reserved'
              ? `裝備槽 ${slotIndex + 1}：裝備即將抵達`
              : `裝備槽 ${slotIndex + 1}：空`
        }
        aria-pressed={selected}
        aria-disabled={!interactive || slot.status === 'reserved'}
        onClick={() => onActivate(slotIndex)}
        onPointerDown={(event) => {
          if (instance) onInstancePointerDown(instance.instanceId, event)
        }}
        onMouseEnter={(event) => {
          if (instance) onShowTooltip(instance, event.currentTarget)
        }}
        onMouseLeave={() => {
          if (instance) onHideTooltip(instance.instanceId)
        }}
        onFocus={(event) => {
          if (instance) onShowTooltip(instance, event.currentTarget)
        }}
        onBlur={() => {
          if (instance) onHideTooltip(instance.instanceId)
        }}
      >
        {interactive && instance && (
          <span className="equipment-hud__slot-card">
            <EquipmentCardVisual instance={instance} />
          </span>
        )}
        {slot.status === 'reserved' && (
          <span className="equipment-hud__incoming" aria-hidden="true">
            …
          </span>
        )}
      </button>
    </div>
  )
}

function centerOf(element: Element | null | undefined): Vector2 | null {
  if (!element) return null
  const bounds = element.getBoundingClientRect()
  if (bounds.width <= 0 || bounds.height <= 0) return null
  return {
    x: bounds.left + bounds.width / 2,
    y: bounds.top + bounds.height / 2,
  }
}
