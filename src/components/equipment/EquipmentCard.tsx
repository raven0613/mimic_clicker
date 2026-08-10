import type { PointerEvent as ReactPointerEvent } from 'react'

import normalCardFrameUrl from '../../assets/effects/card_frame/normal.png'
import ringCardUrl from '../../assets/equipment/decoration/ring_pearl.png'
import swordCardUrl from '../../assets/equipment/weapon/sword.png'
import type { EquipmentId } from '../../configs/equipmentConfig'
import type { EquipmentInstance } from '../../service/game/equipment/equipmentState'
import { getEquipmentPresentation } from '../../service/game/equipment/equipmentPresentation'

const equipmentArtById: Record<EquipmentId, string> = {
  sword: swordCardUrl,
  ring: ringCardUrl,
}

interface EquipmentCardProps {
  instance: EquipmentInstance
  selected: boolean
  onClick: (instanceId: number) => void
  onPointerDown: (
    instanceId: number,
    event: ReactPointerEvent<HTMLElement>,
  ) => void
  onShowTooltip: (instance: EquipmentInstance, element: HTMLElement) => void
  onHideTooltip: (instanceId: number) => void
}

export function EquipmentCard({
  instance,
  selected,
  onClick,
  onPointerDown,
  onShowTooltip,
  onHideTooltip,
}: EquipmentCardProps) {
  const presentation = getEquipmentPresentation(instance.id)
  const accessibleLabel = `${presentation.displayName}，稀有度 ${instance.rarity}。${presentation.effectText}`

  return (
    <button
      type="button"
      className={`equipment-card${selected ? ' equipment-card--selected' : ''}`}
      aria-label={accessibleLabel}
      aria-pressed={selected}
      onClick={(event) => {
        event.stopPropagation()
        onClick(instance.instanceId)
      }}
      onPointerDown={(event) => {
        event.stopPropagation()
        onPointerDown(instance.instanceId, event)
      }}
      onDragStart={(event) => event.preventDefault()}
      onMouseEnter={(event) => onShowTooltip(instance, event.currentTarget)}
      onMouseLeave={() => onHideTooltip(instance.instanceId)}
      onFocus={(event) => onShowTooltip(instance, event.currentTarget)}
      onBlur={() => onHideTooltip(instance.instanceId)}
    >
      <EquipmentCardVisual instance={instance} />
      <span className="equipment-card__name">{presentation.displayName}</span>
    </button>
  )
}

export function EquipmentCardVisual({
  instance,
}: {
  instance: EquipmentInstance
}) {
  return (
    <span
      className={`equipment-card-visual equipment-card-visual--${instance.rarity.toLowerCase()}`}
      aria-hidden="true"
    >
      <img
        className="equipment-card-visual__frame"
        src={normalCardFrameUrl}
        alt=""
        draggable={false}
      />
      <img
        className="equipment-card-visual__art"
        src={equipmentArtById[instance.id]}
        alt=""
        draggable={false}
      />
    </span>
  )
}
