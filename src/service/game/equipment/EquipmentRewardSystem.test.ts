import { beforeAll, describe, expect, it, vi } from 'vitest'

import { Container, Texture } from 'pixi.js'

import { animationConfig } from '../../../configs/animationConfig'
import { combatConfig } from '../../../configs/combatConfig'
import { equipmentConfig } from '../../../configs/equipmentConfig'
import { getInitialWeaponDefinition } from '../../progression/weaponProgression'
import type { LoadedAttachedCardTextures } from '../assets/runtimeAssets'
import type { EquipmentInventorySnapshot } from './equipmentState'
import {
  advanceEquipmentRewardMotion,
  createEquipmentRewardMotion,
  isEquipmentRewardMotionSettled,
} from './equipmentRewardMotion'

const fieldSize = { x: 800, y: 600 }
const source = { x: fieldSize.x / 2, y: fieldSize.y / 3 }
const initialWeaponDamage = getInitialWeaponDefinition().baseDamage
const textures: LoadedAttachedCardTextures = {
  frames: { normal: Texture.WHITE },
  effectIcons: {
    thunder: Texture.EMPTY,
    meteorite: Texture.EMPTY,
    tornado: Texture.EMPTY,
  },
  equipmentCards: { sword: Texture.EMPTY, ring: Texture.EMPTY },
}

describe('equipment reward collection timing', () => {
  beforeAll(() => {
    vi.stubGlobal('document', {
      createElement: () => ({ getContext: () => null }),
    })
  })

  it('does not activate until coin completion, post-delay, and collection flight finish', async () => {
    const system = await createSystem()
    const motion = createReferenceMotion()
    advanceUntilSettled(system, motion)

    system.update(
      animationConfig.equipmentReward.postCoinCollectionDelayMs +
        animationConfig.equipmentReward.collectionDurationMs,
    )
    expect(system.calculateWeaponDamage(initialWeaponDamage)).toBe(
      initialWeaponDamage,
    )

    system.notifyCoinCollectionCompleted(1)
    system.update(animationConfig.equipmentReward.postCoinCollectionDelayMs - 1)
    expect(system.calculateWeaponDamage(initialWeaponDamage)).toBe(
      initialWeaponDamage,
    )

    system.update(1)
    system.update(animationConfig.equipmentReward.collectionDurationMs - 2)
    expect(system.calculateWeaponDamage(initialWeaponDamage)).toBe(
      initialWeaponDamage,
    )

    system.update(1)
    expect(system.calculateWeaponDamage(initialWeaponDamage)).toBe(
      initialWeaponDamage +
        equipmentConfig.sword.weaponDamageBonus,
    )
  })

  it('uses the no-coin fallback but still waits for the projectile to settle', async () => {
    const system = await createSystem(null)
    const motion = createReferenceMotion()
    advanceBoth(
      system,
      motion,
      animationConfig.equipmentReward.noCoinFallbackDelayMs,
    )

    expect(system.calculateWeaponDamage(initialWeaponDamage)).toBe(
      initialWeaponDamage,
    )

    const collectionStartDeltaMs = advanceUntilSettled(system, motion)
    system.update(
      animationConfig.equipmentReward.collectionDurationMs -
        collectionStartDeltaMs -
        1,
    )
    expect(system.calculateWeaponDamage(initialWeaponDamage)).toBe(
      initialWeaponDamage,
    )

    system.update(1)
    expect(system.calculateWeaponDamage(initialWeaponDamage)).toBe(
      initialWeaponDamage +
        equipmentConfig.sword.weaponDamageBonus,
    )
  })

  it('keeps a successful airborne reward in the settlement snapshot', async () => {
    const system = await createSystem()

    expect(system.getSettlementEquipmentSnapshot()).toEqual(['sword'])

    system.clear()
    expect(system.getSettlementEquipmentSnapshot()).toEqual([])
  })

  it('publishes low-frequency snapshots when a reward is reserved and equipped', async () => {
    const snapshots: EquipmentInventorySnapshot[] = []
    const system = await createSystem(1, (snapshot) => snapshots.push(snapshot))
    expect(snapshots.at(-1)?.slots[0]).toMatchObject({ status: 'reserved' })

    const motion = createReferenceMotion()
    advanceUntilSettled(system, motion)
    system.notifyCoinCollectionCompleted(1)
    system.update(
      animationConfig.equipmentReward.postCoinCollectionDelayMs +
        animationConfig.equipmentReward.collectionDurationMs,
    )

    expect(snapshots.at(-1)?.slots[0]).toMatchObject({
      status: 'equipped',
      instance: { id: 'sword' },
    })
  })
})

async function createSystem(
  rewardEventId: number | null = 1,
  onInventoryChanged?: (snapshot: EquipmentInventorySnapshot) => void,
) {
  const { EquipmentRewardSystem } = await import('./EquipmentRewardSystem')
  const host = {
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: fieldSize.x,
      height: fieldSize.y,
    }),
  } as HTMLElement
  const system = new EquipmentRewardSystem(
    new Container(),
    host,
    textures,
    () => 0.5,
    onInventoryChanged,
  )
  system.setCollectionTargetsFromViewport(
    {
      slotTargets: [{ x: source.x, y: fieldSize.y - 50 }],
      backpackTarget: { x: fieldSize.x - 50, y: fieldSize.y - 50 },
    },
    fieldSize,
  )
  system.resolveDrops({
    visibleCards: [],
    hiddenEquipmentId: 'sword',
    source,
    fieldHeight: fieldSize.y,
    rewardEventId,
  })
  return system
}

function createReferenceMotion() {
  return createEquipmentRewardMotion({
    ...source,
    fieldHeight: fieldSize.y,
    random: () => 0.5,
  })
}

function advanceUntilSettled(
  system: Awaited<ReturnType<typeof createSystem>>,
  motion: ReturnType<typeof createReferenceMotion>,
): number {
  const maximumSteps = 1_000
  let lastDeltaMs = 0
  for (
    let step = 0;
    step < maximumSteps && !isEquipmentRewardMotionSettled(motion);
    step += 1
  ) {
    lastDeltaMs = combatConfig.maximumFrameDeltaMs
    advanceEquipmentRewardMotion(motion, lastDeltaMs)
    system.update(lastDeltaMs)
  }
  expect(isEquipmentRewardMotionSettled(motion)).toBe(true)
  return lastDeltaMs
}

function advanceBoth(
  system: Awaited<ReturnType<typeof createSystem>>,
  motion: ReturnType<typeof createReferenceMotion>,
  totalMs: number,
): void {
  let remainingMs = totalMs
  while (remainingMs > 0) {
    const deltaMs = Math.min(remainingMs, combatConfig.maximumFrameDeltaMs)
    advanceEquipmentRewardMotion(motion, deltaMs)
    system.update(deltaMs)
    remainingMs -= deltaMs
  }
}
