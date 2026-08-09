import type { PermanentUpgradeSnapshot, Vector2 } from '../../../types/game'
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
  addManualHitEffect: (position: Vector2) => void
}

export class RuntimeWeaponAttackSystem {
  private readonly input: RuntimeWeaponAttackSystemInput
  private upgrades: PermanentUpgradeSnapshot | null = null
  private hoveredEntity: RuntimeMimicEntity | null = null
  private automaticAttackRemainingMs = 0

  public constructor(input: RuntimeWeaponAttackSystemInput) {
    this.input = input
  }

  public startRound(upgrades: PermanentUpgradeSnapshot): void {
    this.clear()
    this.upgrades = {
      weaponDamage: upgrades.weaponDamage,
      hoverAutoAttack: { ...upgrades.hoverAutoAttack },
      equipmentSlotCount: upgrades.equipmentSlotCount,
    }
  }

  public attackManual(entity: RuntimeMimicEntity, position: Vector2): void {
    const upgrades = this.requireUpgrades()
    performRuntimeWeaponAttack({
      source: 'manual',
      entity,
      position,
      attackAtMs: this.input.getRoundElapsedMs(),
      baseWeaponDamage: upgrades.weaponDamage,
      equipment: this.input.getEquipment(),
      damageTarget: (target, damage) =>
        this.input.damageTarget(target, damage, 'manual'),
      addManualHitEffect: this.input.addManualHitEffect,
    })
  }

  public setHovered(entity: RuntimeMimicEntity, hovered: boolean): void {
    const hoverAttack = this.upgrades?.hoverAutoAttack
    if (!hoverAttack?.isUnlocked) return
    if (hovered) {
      this.hoveredEntity = entity
      this.automaticAttackRemainingMs = hoverAttack.intervalMs
    } else if (this.hoveredEntity === entity) {
      this.clearHover()
    }
  }

  public update(deltaMs: number, includeEndpoint: boolean): void {
    const entity = this.hoveredEntity
    const upgrades = this.upgrades
    if (!entity || !upgrades?.hoverAutoAttack.isUnlocked) return
    if (!this.input.getEntities().includes(entity)) {
      this.clearHover()
      return
    }

    const tick = advanceHoverAutomaticAttack(
      this.automaticAttackRemainingMs,
      deltaMs,
      upgrades.hoverAutoAttack.intervalMs,
      includeEndpoint,
    )
    this.automaticAttackRemainingMs = tick.remainingMs
    if (!tick.shouldAttack) return

    performRuntimeWeaponAttack({
      source: 'automatic',
      entity,
      attackAtMs: this.input.getRoundElapsedMs(),
      baseWeaponDamage: upgrades.weaponDamage,
      equipment: this.input.getEquipment(),
      damageTarget: (target, damage) =>
        this.input.damageTarget(target, damage, 'automatic'),
      addManualHitEffect: this.input.addManualHitEffect,
    })
  }

  public removeEntity(entity: RuntimeMimicEntity): void {
    if (this.hoveredEntity === entity) this.clearHover()
  }

  public clear(): void {
    this.clearHover()
    this.upgrades = null
  }

  private clearHover(): void {
    this.hoveredEntity = null
    this.automaticAttackRemainingMs = 0
  }

  private requireUpgrades(): PermanentUpgradeSnapshot {
    if (!this.upgrades) {
      throw new Error('A weapon attack requires an active round upgrade snapshot')
    }
    return this.upgrades
  }
}
