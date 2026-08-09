import { describe, expect, it } from 'vitest'

import { balanceSimulationConfig } from '../../configs/balanceSimulationConfig'
import { mimicConfigs } from '../../configs/mimicConfigs'
import { createSeededRandom } from './createSeededRandom'
import { simulateCoinCollectionCompletionMs } from './coinRewardTimingSimulation'

describe('coin reward timing simulation', () => {
  it('replays the shared coin motion deterministically', () => {
    const input = {
      reward: mimicConfigs.normal.baseReward,
      x: balanceSimulationConfig.field.widthPixels / 2,
      y: balanceSimulationConfig.field.heightPixels / 2,
      fieldHeight: balanceSimulationConfig.field.heightPixels,
    }
    const firstDuration = simulateCoinCollectionCompletionMs({
      ...input,
      random: createSeededRandom(balanceSimulationConfig.seeds[0]),
    })
    const repeatedDuration = simulateCoinCollectionCompletionMs({
      ...input,
      random: createSeededRandom(balanceSimulationConfig.seeds[0]),
    })

    expect(firstDuration).toBeGreaterThan(0)
    expect(repeatedDuration).toBe(firstDuration)
  })

  it('completes immediately when no coin visual is created', () => {
    expect(
      simulateCoinCollectionCompletionMs({
        reward: 0,
        x: 0,
        y: 0,
        fieldHeight: balanceSimulationConfig.field.heightPixels,
        random: createSeededRandom(balanceSimulationConfig.seeds[0]),
      }),
    ).toBe(0)
  })
})
