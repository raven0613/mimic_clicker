import { spawnConfig } from '../../../configs/spawnConfig'
import type { RuntimeMimicEntity } from '../runtimeTypes'
import { ClearRefillController } from './clearRefillController'
import type { ClearRefillDecision } from './clearRefillController'
import { isEffectiveClearRefillTarget } from './clearRefillTargets'

interface RuntimeClearRefillSystemInput {
  getEntities: () => readonly RuntimeMimicEntity[]
  getFieldSize: () => { width: number; height: number }
  getRoundState: () => {
    isRoundActive: boolean
    remainingRoundMs: number
  }
  hasActiveEffectChain: () => boolean
  refill: (decision: ClearRefillDecision) => void
}

export class RuntimeClearRefillSystem {
  private readonly controller = new ClearRefillController()
  private readonly input: RuntimeClearRefillSystemInput

  public constructor(input: RuntimeClearRefillSystemInput) {
    this.input = input
  }

  public update(deltaMs: number): void {
    const decision = this.controller.update({
      deltaMs,
      ...this.createFieldState(),
    })
    if (decision) this.input.refill(decision)
  }

  public notifyCombatEntityRemovedByDefeat(): void {
    this.controller.notifyTargetRemoved({
      cause: 'defeat',
      ...this.createFieldState(),
    })
  }

  public notifyValidManualWeaponDamage(): void {
    this.controller.notifyValidManualWeaponDamage()
  }

  public reset(): void {
    this.controller.reset()
  }

  private createFieldState(): {
    hasActiveEffectChain: boolean
    effectiveTargetCount: number
    isJackpotChaseActive: boolean
    isRoundActive: boolean
    remainingRoundMs: number
  } {
    const round = this.input.getRoundState()
    return {
      ...round,
      hasActiveEffectChain: this.input.hasActiveEffectChain(),
      effectiveTargetCount: this.countEffectiveTargets(),
      isJackpotChaseActive: this.input.getEntities().some(
        (entity) =>
          entity.role === 'jackpot' &&
          entity.jackpotLifecycle?.phase === 'chasing',
      ),
    }
  }

  private countEffectiveTargets(): number {
    const field = this.input.getFieldSize()
    const fieldBounds = { x: 0, y: 0, ...field }
    return this.input.getEntities().filter((entity) =>
      isEffectiveClearRefillTarget(
        {
          bounds: {
            x: entity.logicalX - spawnConfig.cardWidthPixels / 2,
            y: entity.logicalY - spawnConfig.cardHeightPixels / 2,
            width: spawnConfig.cardWidthPixels,
            height: spawnConfig.cardHeightPixels,
          },
          health: entity.health,
          jackpotPhase: entity.jackpotLifecycle?.phase ?? null,
          role: entity.role,
        },
        fieldBounds,
      ),
    ).length
  }
}
