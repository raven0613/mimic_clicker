import type { PointerEvent as ReactPointerEvent } from 'react'

import type { EquipmentSortMode } from '../../service/game/equipment/equipmentInventory'
import type { EquipmentInstance } from '../../service/game/equipment/equipmentState'
import { EquipmentCard } from './EquipmentCard'

interface BackpackPanelProps {
  instances: readonly EquipmentInstance[]
  sortMode: EquipmentSortMode
  selectedInstanceId: number | null
  onSortModeChange: (mode: EquipmentSortMode) => void
  onClose: () => void
  onBackpackActivate: () => void
  onInstanceClick: (instanceId: number) => void
  onInstancePointerDown: (
    instanceId: number,
    event: ReactPointerEvent<HTMLElement>,
  ) => void
  onShowTooltip: (instance: EquipmentInstance, element: HTMLElement) => void
  onHideTooltip: (instanceId: number) => void
  backpackDropActive: boolean
  backpackDropHovered: boolean
}

export function BackpackPanel({
  instances,
  sortMode,
  selectedInstanceId,
  onSortModeChange,
  onClose,
  onBackpackActivate,
  onInstanceClick,
  onInstancePointerDown,
  onShowTooltip,
  onHideTooltip,
  backpackDropActive,
  backpackDropHovered,
}: BackpackPanelProps) {
  return (
    <div
      className="backpack-overlay"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        id="backpack-panel"
        className="backpack-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="backpack-panel-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="backpack-panel__header">
          <div>
            <span className="backpack-panel__eyebrow">本局收藏</span>
            <h2 id="backpack-panel-title">背包</h2>
          </div>
          <button
            type="button"
            className="backpack-panel__close"
            aria-label="關閉背包"
            onClick={onClose}
            autoFocus
          >
            ×
          </button>
        </header>

        <div className="backpack-panel__sort" aria-label="背包排序方式">
          <button
            type="button"
            aria-pressed={sortMode === 'acquiredNewest'}
            onClick={() => onSortModeChange('acquiredNewest')}
          >
            取得時間
          </button>
          <button
            type="button"
            aria-pressed={sortMode === 'rarityHighest'}
            onClick={() => onSortModeChange('rarityHighest')}
          >
            稀有度
          </button>
        </div>

        <div
          className={`backpack-panel__inventory${
            backpackDropActive ? ' backpack-panel__inventory--drop-active' : ''
          }${
            backpackDropHovered
              ? ' backpack-panel__inventory--drop-hovered'
              : ''
          }`}
          data-equipment-drop-target="backpack"
          onClick={(event) => {
            if (!(event.target as Element).closest('button')) {
              onBackpackActivate()
            }
          }}
        >
          {instances.length === 0 ? (
            <p className="backpack-panel__empty">目前沒有收進背包的裝備</p>
          ) : (
            <div className="backpack-panel__grid">
              {instances.map((instance) => (
                <EquipmentCard
                  instance={instance}
                  selected={selectedInstanceId === instance.instanceId}
                  onClick={onInstanceClick}
                  onPointerDown={onInstancePointerDown}
                  onShowTooltip={onShowTooltip}
                  onHideTooltip={onHideTooltip}
                  key={instance.instanceId}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
