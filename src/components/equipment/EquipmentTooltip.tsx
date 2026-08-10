import { createPortal } from 'react-dom'

import type { EquipmentInstance } from '../../service/game/equipment/equipmentState'
import { getEquipmentPresentation } from '../../service/game/equipment/equipmentPresentation'

export interface EquipmentTooltipState {
  instance: EquipmentInstance
  anchor: { top: number; right: number; bottom: number; left: number }
}

export function EquipmentTooltip({ state }: { state: EquipmentTooltipState }) {
  const presentation = getEquipmentPresentation(state.instance.id)
  const tooltipWidth = 264
  const viewportPadding = 16
  const centeredLeft =
    (state.anchor.left + state.anchor.right - tooltipWidth) / 2
  const left = Math.min(
    window.innerWidth - tooltipWidth - viewportPadding,
    Math.max(viewportPadding, centeredLeft),
  )
  const placeBelow = state.anchor.top < 132

  return createPortal(
    <div
      className={`equipment-tooltip${
        placeBelow ? ' equipment-tooltip--below' : ''
      }`}
      role="tooltip"
      style={{
        left,
        top: placeBelow ? state.anchor.bottom + 10 : state.anchor.top - 10,
      }}
    >
      <strong>{presentation.displayName}</strong>
      <span>{presentation.effectText}</span>
    </div>,
    document.body,
  )
}
