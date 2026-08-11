import type { RoundProgressionSnapshot, Vector2 } from '../../../types/game'
import type { EquipmentRewardSystem } from '../equipment/EquipmentRewardSystem'
import type { RuntimeMimicEntity } from '../runtimeTypes'
import { advanceHoverAutomaticAttack } from './hoverAutomaticAttack'
import { performRuntimeWeaponAttack } from './runtimeWeaponAttack'

type RuntimeWeaponSource = 'manual' | 'automatic'

interface RuntimeWeaponAttackSystemInput {
  getRoundElapsedMs: () => number
  getEntities: () => readonly RuntimeMimicEntity[]
  getEquipment: () => EquipmentRewardSystem | null
  damageTarget: (
    entity: RuntimeMimicEntity,
    damage: number,
    source: RuntimeWeaponSource,
  ) => boolean
  addWeaponHitEffect: (position: Vector2, tintColor?: string) => void
}

export class RuntimeWeaponAttackSystem {
  private readonly input: RuntimeWeaponAttackSystemInput
  private progression: RoundProgressionSnapshot | null = null
  private hoveredEntity: RuntimeMimicEntity | null = null
  private hoveredPointerPosition: Vector2 | null = null
  private automaticAttackRemainingMs = 0

  public constructor(input: RuntimeWeaponAttackSystemInput) {
    this.input = input
  }

  public startRound(progression: RoundProgressionSnapshot): void {
    this.clear()
    this.progression = {
      weapon: { ...progression.weapon },
      hoverAutoAttack: { ...progression.hoverAutoAttack },
      equipmentSlotCount: progression.equipmentSlotCount,
    }
  }

  public attackManual(entity: RuntimeMimicEntity, position: Vector2): void {
    const progression = this.requireProgression()
    performRuntimeWeaponAttack({
      source: 'manual',
      entity,
      pointerPosition: position,
      attackAtMs: this.input.getRoundElapsedMs(),
      baseWeaponDamage: progression.weapon.baseDamage,
      equipment: this.input.getEquipment(),
      damageTarget: (target, damage) =>
        this.input.damageTarget(target, damage, 'manual'),
      addWeaponHitEffect: this.input.addWeaponHitEffect,
    })
  }

  public setHoverPosition(
    entity: RuntimeMimicEntity,
    position: Vector2 | null,
  ): void {
    const hoverAttack = this.progression?.hoverAutoAttack
    if (!hoverAttack?.isUnlocked) return
    if (position) {
      if (this.hoveredEntity !== entity) {
        this.automaticAttackRemainingMs = hoverAttack.intervalMs
      }
      this.hoveredEntity = entity
      this.hoveredPointerPosition = { ...position }
    } else if (this.hoveredEntity === entity) {
      this.clearHover()
    }
  }

  public update(deltaMs: number, includeEndpoint: boolean): void {
    const entity = this.hoveredEntity
    const pointerPosition = this.hoveredPointerPosition
    const progression = this.progression
    if (
      !entity ||
      !pointerPosition ||
      !progression?.hoverAutoAttack.isUnlocked
    ) {
      return
    }
    if (!this.input.getEntities().includes(entity)) {
      this.clearHover()
      return
    }

    const tick = advanceHoverAutomaticAttack(
      this.automaticAttackRemainingMs,
      deltaMs,
      progression.hoverAutoAttack.intervalMs,
      includeEndpoint,
    )
    this.automaticAttackRemainingMs = tick.remainingMs
    if (!tick.shouldAttack) return

    performRuntimeWeaponAttack({
      source: 'automatic',
      entity,
      pointerPosition,
      attackAtMs: this.input.getRoundElapsedMs(),
      baseWeaponDamage: progression.weapon.baseDamage,
      equipment: this.input.getEquipment(),
      damageTarget: (target, damage) =>
        this.input.damageTarget(target, damage, 'automatic'),
      addWeaponHitEffect: this.input.addWeaponHitEffect,
    })
  }

  public removeEntity(entity: RuntimeMimicEntity): void {
    if (this.hoveredEntity === entity) this.clearHover()
  }

  public clear(): void {
    this.clearHover()
    this.progression = null
  }

  private clearHover(): void {
    this.hoveredEntity = null
    this.hoveredPointerPosition = null
    this.automaticAttackRemainingMs = 0
  }

  private requireProgression(): RoundProgressionSnapshot {
    if (!this.progression) {
      throw new Error(
        'A weapon attack requires an active round progression snapshot',
      )
    }
    return this.progression
  }
}
