import { describe, expect, it } from 'vitest'

import { attachedCardConfig } from '../../../configs/attachedCardConfig'
import { combatConfig } from '../../../configs/combatConfig'
import {
  advanceEquipmentRewardMotion,
  createEquipmentRewardMotion,
  isEquipmentRewardMotionSettled,
} from './equipmentRewardMotion'

describe('equipment reward motion', () => {
  it('launches high enough to read as a projectile before settling', () => {
    const sourceY = attachedCardConfig.card.displayHeightPixels * 8
    const motion = createEquipmentRewardMotion({
      x: 0,
      y: sourceY,
      fieldHeight: sourceY * 3,
      random: () => 0.5,
    })
    let minimumY = motion.y

    while (motion.phase !== 'resting') {
      advanceEquipmentRewardMotion(motion, combatConfig.maximumFrameDeltaMs)
      minimumY = Math.min(minimumY, motion.y)
    }

    expect(minimumY).toBeLessThan(
      sourceY - attachedCardConfig.card.displayHeightPixels,
    )
  })

  it('finishes its configured ground bounces before becoming collectible', () => {
    const motion = createEquipmentRewardMotion({
      x: 0,
      y: 0,
      fieldHeight: attachedCardConfig.card.displayHeightPixels * 10,
      random: () => 0,
    })

    while (motion.phase !== 'resting') {
      advanceEquipmentRewardMotion(motion, combatConfig.maximumFrameDeltaMs)
    }

    expect(motion.remainingBounces).toBe(0)
    expect(motion.y).toBe(motion.groundY)
    expect(isEquipmentRewardMotionSettled(motion)).toBe(false)

    advanceEquipmentRewardMotion(
      motion,
      motion.restDurationMs + combatConfig.maximumFrameDeltaMs,
    )

    expect(isEquipmentRewardMotionSettled(motion)).toBe(true)
  })
})
