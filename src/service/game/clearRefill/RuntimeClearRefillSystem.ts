import { spawnConfig } from '../../../configs/spawnConfig'
import type { RuntimeMimicEntity } from '../runtimeTypes'
import { ClearRefillController } from './clearRefillController'
import { isEffectiveClearRefillTarget } from './clearRefillTargets'

interface RuntimeClearRefillSystemInput {
  getEntities: () => readonly RuntimeMimicEntity[]
  getFieldSize: () => { width: number; height: number }
  getRoundState: () => {
    isRoundActive: boolean
    remainingRoundMs: number
  }
  hasActiveEffectChain: () => boolean
  refill: () => void
}

export class RuntimeClearRefillSystem {
  private readonly controller = new ClearRefillController()
  private readonly input: RuntimeClearRefillSystemInput

  public constructor(input: RuntimeClearRefillSystemInput) {
    this.input = input
  }

  public update(deltaMs: number): void {
    if (this.controller.update({ deltaMs, ...this.createFieldState() })) {
      this.input.refill()
    }
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
    hasEffectiveTarget: boolean
    isRoundActive: boolean
    remainingRoundMs: number
  } {
    const round = this.input.getRoundState()
    return {
      ...round,
      hasActiveEffectChain: this.input.hasActiveEffectChain(),
      hasEffectiveTarget: this.hasEffectiveTarget(),
    }
  }

  private hasEffectiveTarget(): boolean {
    const field = this.input.getFieldSize()
    const fieldBounds = { x: 0, y: 0, ...field }
    return this.input.getEntities().some((entity) =>
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
    )
  }
}
