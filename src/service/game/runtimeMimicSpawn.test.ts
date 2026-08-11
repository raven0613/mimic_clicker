import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MimicId } from '../../types/game'
import type { LoadedAttachedCardTextures } from './assets/runtimeAssets'
import { createRuntimeMimicEntity } from './runtimeEntityFactory'
import { RuntimeMimicSpawner } from './runtimeMimicSpawn'
import type { LoadedMimicTextures, RuntimeMimicEntity } from './runtimeTypes'

vi.mock('./runtimeEntityFactory', () => ({
  createRuntimeMimicEntity: vi.fn((input: MockRuntimeMimicInput) =>
    ({
      runtimeId: input.runtimeId,
      mimicId: input.mimicId,
      role: input.role,
      logicalX: input.centerX,
      logicalY: input.centerY,
    }) as RuntimeMimicEntity,
  ),
}))

interface MockRuntimeMimicInput {
  runtimeId: number
  mimicId: MimicId
  role: RuntimeMimicEntity['role']
  centerX: number
  centerY: number
  playRefillEntrance: boolean
}

const mockedCreateRuntimeMimicEntity = vi.mocked(createRuntimeMimicEntity)

describe('runtime Mimic spawn presentation', () => {
  beforeEach(() => {
    mockedCreateRuntimeMimicEntity.mockClear()
  })

  it.each([
    { presentation: 'immediate' as const, expectedAnimation: false },
    { presentation: 'clearRefill' as const, expectedAnimation: true },
  ])(
    'routes $presentation field fills to the expected entrance animation',
    ({ presentation, expectedAnimation }) => {
      const spawner = createSpawner()

      expect(spawner.fillField(['normal'], presentation)).toBeGreaterThan(0)
      expect(mockedCreateRuntimeMimicEntity).toHaveBeenCalled()
      for (const [input] of mockedCreateRuntimeMimicEntity.mock.calls) {
        expect(input.playRefillEntrance).toBe(expectedAnimation)
      }
    },
  )

  it('keeps top-edge spawns on the immediate presentation', () => {
    const spawner = createSpawner()

    expect(spawner.spawnTopEdge('normal', 'regular', false)).toBe(true)
    expect(mockedCreateRuntimeMimicEntity).toHaveBeenCalledWith(
      expect.objectContaining({ playRefillEntrance: false }),
    )
  })

  it('stops a refill after creating the requested number of new targets', () => {
    let randomCallCount = 0
    const spawner = createSpawner(() => {
      randomCallCount += 1
      if (randomCallCount <= 16) return 0
      if (randomCallCount <= 32) return 1
      return 0.5
    })
    const requestedCount = 2

    expect(
      spawner.fillField(['normal'], 'clearRefill', requestedCount),
    ).toBe(requestedCount)
  })
})

function createSpawner(random: () => number = () => 0.5): RuntimeMimicSpawner {
  const entities: RuntimeMimicEntity[] = []
  return new RuntimeMimicSpawner({
    getFieldSize: () => ({ x: 800, y: 600 }),
    getEntities: () => entities,
    mimicTextures: {} as LoadedMimicTextures,
    attachedCardTextures: {} as LoadedAttachedCardTextures,
    random,
    onAttack: vi.fn(),
    onHoverChanged: vi.fn(),
    onSpawn: (entity) => entities.push(entity),
  })
}
