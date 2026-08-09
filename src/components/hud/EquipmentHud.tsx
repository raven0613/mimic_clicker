import { useLayoutEffect, useRef } from 'react'

import backpackImageUrl from '../../assets/equipment/backpack.png'
import { equipmentConfig } from '../../configs/equipmentConfig'
import type { EquipmentCollectionTargets, Vector2 } from '../../types/game'

interface EquipmentHudProps {
  onTargetsChange: (targets: EquipmentCollectionTargets) => void
}

export function EquipmentHud({ onTargetsChange }: EquipmentHudProps) {
  const slotRefs = useRef<Array<HTMLDivElement | null>>([])
  const backpackRef = useRef<HTMLImageElement>(null)

  useLayoutEffect(() => {
    const reportTargets = () => {
      onTargetsChange({
        slotTargets: Array.from(
          { length: equipmentConfig.initialSlotCount },
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
          { length: equipmentConfig.initialSlotCount },
          () => null,
        ),
        backpackTarget: null,
      })
    }
  }, [onTargetsChange])

  return (
    <div className="equipment-hud" aria-label="Equipment">
      <div className="equipment-hud__slots">
        {Array.from(
          { length: equipmentConfig.initialSlotCount },
          (_, slotIndex) => (
            <div
              className="equipment-hud__slot"
              data-equipment-slot-index={slotIndex}
              key={slotIndex}
              ref={(element) => {
                slotRefs.current[slotIndex] = element
              }}
            />
          ),
        )}
      </div>
      <div className="equipment-hud__backpack-frame">
        <img
          className="equipment-hud__backpack"
          src={backpackImageUrl}
          alt="Backpack"
          ref={backpackRef}
        />
      </div>
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
