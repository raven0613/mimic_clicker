import { Texture, type FederatedPointerEvent } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'

import type { LoadedAttachedCardTextures } from './assets/runtimeAssets'
import { createRuntimeMimicEntity } from './runtimeEntityFactory'
import type { LoadedMimicTextures } from './runtimeTypes'

describe('runtime Mimic pointer position routing', () => {
  it('reports enter and move world positions, then clears the position on leave', () => {
    const onHoverChanged = vi.fn()
    const entity = createRuntimeMimicEntity({
      runtimeId: 1,
      mimicId: 'normal',
      role: 'regular',
      decorative: false,
      centerX: 100,
      centerY: 200,
      fieldHeight: 600,
      textures: createMimicTextures(),
      attachedCardTextures: createAttachedCardTextures(),
      attachedCardAssignments: [],
      hiddenEquipmentId: null,
      playRefillEntrance: false,
      onAttack: vi.fn(),
      onHoverChanged,
    })

    entity.container.emit('pointerenter', createPointerEvent(12, 34))
    entity.container.emit('pointermove', createPointerEvent(56, 78))
    entity.container.emit('pointerleave', createPointerEvent(90, 120))

    expect(onHoverChanged).toHaveBeenNthCalledWith(1, entity, { x: 12, y: 34 })
    expect(onHoverChanged).toHaveBeenNthCalledWith(2, entity, { x: 56, y: 78 })
    expect(onHoverChanged).toHaveBeenNthCalledWith(3, entity, null)
  })
})

function createPointerEvent(x: number, y: number): FederatedPointerEvent {
  return { global: { x, y } } as FederatedPointerEvent
}

function createMimicTextures(): LoadedMimicTextures {
  return {
    normal: Texture.EMPTY,
    rare1: Texture.EMPTY,
    rare2: Texture.EMPTY,
    jackpot: Texture.EMPTY,
  }
}

function createAttachedCardTextures(): LoadedAttachedCardTextures {
  return {
    frames: { normal: Texture.EMPTY },
    effectIcons: {
      thunder: Texture.EMPTY,
      meteorite: Texture.EMPTY,
      tornado: Texture.EMPTY,
    },
    equipmentCards: {
      sword: Texture.EMPTY,
      ring: Texture.EMPTY,
    },
  }
}
