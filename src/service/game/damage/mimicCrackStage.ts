import { mimicDamageVisualConfig } from '../../../configs/mimicDamageVisualConfig'

export type MimicCrackStage = 'intact' | 'subtle' | 'severe' | 'destroyed'

export function selectMimicCrackStage(
  currentHealth: number,
  maximumHealth: number,
): MimicCrackStage {
  if (!Number.isFinite(maximumHealth) || maximumHealth <= 0) {
    throw new Error(
      `Cannot select a Mimic crack stage with maximum health ${maximumHealth}`,
    )
  }
  if (!Number.isFinite(currentHealth)) {
    throw new Error(
      `Cannot select a Mimic crack stage with current health ${currentHealth}`,
    )
  }
  if (currentHealth <= 0) return 'destroyed'

  const healthRatio = currentHealth / maximumHealth
  const { subtleMaximumHealthRatio, severeMaximumHealthRatio } =
    mimicDamageVisualConfig.crackStages

  if (healthRatio <= severeMaximumHealthRatio) return 'severe'
  if (healthRatio <= subtleMaximumHealthRatio) return 'subtle'
  return 'intact'
}
