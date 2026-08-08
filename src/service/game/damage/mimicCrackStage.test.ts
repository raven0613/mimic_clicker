import { describe, expect, it } from 'vitest'

import { mimicDamageVisualConfig } from '../../../configs/mimicDamageVisualConfig'
import { mimicConfigs } from '../../../configs/mimicConfigs'
import { selectMimicCrackStage } from './mimicCrackStage'

const maximumHealth = mimicConfigs.rare2.maximumHealth
const { subtleMaximumHealthRatio, severeMaximumHealthRatio } =
  mimicDamageVisualConfig.crackStages

describe('mimic crack stage selection', () => {
  it('keeps the configured health thresholds in a valid order', () => {
    expect(severeMaximumHealthRatio).toBeGreaterThan(0)
    expect(severeMaximumHealthRatio).toBeLessThan(subtleMaximumHealthRatio)
    expect(subtleMaximumHealthRatio).toBeLessThan(1)
  })

  it('keeps the card intact above the subtle crack threshold', () => {
    const healthRatio = (1 + subtleMaximumHealthRatio) / 2

    expect(
      selectMimicCrackStage(maximumHealth * healthRatio, maximumHealth),
    ).toBe('intact')
  })

  it('shows subtle cracks at the configured threshold', () => {
    expect(
      selectMimicCrackStage(
        maximumHealth * subtleMaximumHealthRatio,
        maximumHealth,
      ),
    ).toBe('subtle')
  })

  it('shows severe cracks at the configured threshold', () => {
    expect(
      selectMimicCrackStage(
        maximumHealth * severeMaximumHealthRatio,
        maximumHealth,
      ),
    ).toBe('severe')
  })

  it('uses the deepest stage reached after a large health change', () => {
    const severeHealthRatio = severeMaximumHealthRatio / 2

    expect(
      selectMimicCrackStage(
        maximumHealth * severeHealthRatio,
        maximumHealth,
      ),
    ).toBe('severe')
  })

  it('marks zero health as destroyed instead of displaying another crack stage', () => {
    expect(selectMimicCrackStage(0, maximumHealth)).toBe('destroyed')
  })
})
