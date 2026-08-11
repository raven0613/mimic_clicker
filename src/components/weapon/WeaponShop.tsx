import { useState } from 'react'

import './WeaponShop.scss'

import type { WeaponId } from '../../configs/weaponConfig'
import {
  getWeaponShopOffers,
  type WeaponEquipStatus,
  type WeaponPurchaseStatus,
  type WeaponShopOffer,
} from '../../service/progression/weaponProgression'
import type { ProgressData } from '../../types/game'

interface WeaponShopProps {
  progress: ProgressData
  disabled: boolean
  onPurchase: (weaponId: WeaponId) => Promise<WeaponPurchaseStatus>
  onEquip: (weaponId: WeaponId) => Promise<WeaponEquipStatus>
}

export function WeaponShop({
  progress,
  disabled,
  onPurchase,
  onEquip,
}: WeaponShopProps) {
  const [busyWeaponId, setBusyWeaponId] = useState<WeaponId | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const offers = getWeaponShopOffers(progress)

  async function performAction(offer: WeaponShopOffer): Promise<void> {
    if (disabled || busyWeaponId || !isActionable(offer)) return
    setBusyWeaponId(offer.definition.id)
    setMessage(null)
    try {
      if (offer.availability === 'owned') {
        const status = await onEquip(offer.definition.id)
        setMessage(equipStatusMessage(status))
      } else {
        const status = await onPurchase(offer.definition.id)
        setMessage(purchaseStatusMessage(status))
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '武器保存失敗，請再試一次。',
      )
    } finally {
      setBusyWeaponId(null)
    }
  }

  return (
    <section className="weapon-shop" aria-labelledby="weapon-shop-title">
      <div className="weapon-shop__heading">
        <div>
          <h2 id="weapon-shop-title">主武器商店</h2>
          <p>購買後自動裝備，將從下一局生效。</p>
        </div>
        <span>{progress.gold} G</span>
      </div>
      <div className="weapon-shop__offers">
        {offers.map((offer) => (
          <article
            className={`weapon-offer weapon-offer--${offer.availability}`}
            key={offer.definition.id}
          >
            <div className="weapon-offer__title">
              <strong>{offer.definition.displayName}</strong>
              <span>攻擊力 {offer.definition.baseDamage}</span>
            </div>
            <p>{formatRequirement(offer)}</p>
            <button
              className="button button--quiet"
              type="button"
              disabled={
                disabled || busyWeaponId !== null || !isActionable(offer)
              }
              onClick={() => void performAction(offer)}
            >
              {formatActionLabel(offer, busyWeaponId)}
            </button>
          </article>
        ))}
      </div>
      {message && (
        <p className="weapon-shop__message" role="status">
          {message}
        </p>
      )}
    </section>
  )
}

function isActionable(offer: WeaponShopOffer): boolean {
  return offer.availability === 'available' || offer.availability === 'owned'
}

function formatRequirement(offer: WeaponShopOffer): string {
  if (offer.definition.requiredWeaponId === null) {
    return `價格 ${offer.definition.priceGold} G · 初始永久持有`
  }
  return `價格 ${offer.definition.priceGold} G · 前置 ${offer.requiredWeaponName}`
}

function formatActionLabel(
  offer: WeaponShopOffer,
  busyWeaponId: WeaponId | null,
): string {
  if (busyWeaponId === offer.definition.id) return '保存中…'
  switch (offer.availability) {
    case 'equipped':
      return '目前裝備'
    case 'owned':
      return '裝備'
    case 'available':
      return `購買 ${offer.definition.priceGold} G`
    case 'insufficientGold':
      return `需要 ${offer.definition.priceGold} G`
    case 'prerequisiteNotMet':
      return `需要 ${offer.requiredWeaponName}`
  }
}

function purchaseStatusMessage(status: WeaponPurchaseStatus): string {
  switch (status) {
    case 'purchased':
      return '購買完成並已裝備，將從下一局生效。'
    case 'insufficientGold':
      return '金幣不足。'
    case 'prerequisiteNotMet':
      return '尚未持有前置武器。'
    case 'alreadyOwned':
      return '已永久持有這把武器。'
    case 'unknownWeapon':
      return '找不到這把武器。'
  }
}

function equipStatusMessage(status: WeaponEquipStatus): string {
  switch (status) {
    case 'equipped':
      return '已切換裝備，將從下一局生效。'
    case 'alreadyEquipped':
      return '目前已裝備這把武器。'
    case 'notOwned':
      return '尚未持有這把武器。'
    case 'unknownWeapon':
      return '找不到這把武器。'
  }
}
