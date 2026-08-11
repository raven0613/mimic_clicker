import { useState } from 'react'

import './PermanentUpgradeShop.scss'

import {
  getPermanentUpgradeShopOffers,
  type PermanentUpgradePurchaseStatus,
  type PermanentUpgradeShopOffer,
} from '../../service/progression/permanentUpgrades'
import type { PermanentUpgradeId, ProgressData } from '../../types/game'

interface PermanentUpgradeShopProps {
  progress: ProgressData
  onPurchase: (
    upgradeId: PermanentUpgradeId,
  ) => Promise<PermanentUpgradePurchaseStatus>
}

const laneLabels: Record<PermanentUpgradeShopOffer['lane'], string> = {
  hoverAutoAttack: '懸停自動攻擊',
  equipmentSlots: '裝備槽',
}

export function PermanentUpgradeShop({
  progress,
  onPurchase,
}: PermanentUpgradeShopProps) {
  const [busyUpgradeId, setBusyUpgradeId] =
    useState<PermanentUpgradeId | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const offers = getPermanentUpgradeShopOffers(progress)

  async function purchase(offer: PermanentUpgradeShopOffer) {
    if (offer.availability !== 'available' || busyUpgradeId) return
    setBusyUpgradeId(offer.purchaseId)
    setMessage(null)
    try {
      const status = await onPurchase(offer.purchaseId)
      setMessage(purchaseStatusMessage(status))
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '升級保存失敗，請再試一次。',
      )
    } finally {
      setBusyUpgradeId(null)
    }
  }

  return (
    <section className="upgrade-shop" aria-labelledby="upgrade-shop-title">
      <div className="upgrade-shop__heading">
        <h2 id="upgrade-shop-title">永久升級</h2>
        <span>{progress.gold} G</span>
      </div>
      <div className="upgrade-shop__offers">
        {offers.map((offer) => (
          <article className="upgrade-offer" key={offer.lane}>
            <div>
              <strong>{laneLabels[offer.lane]}</strong>
              <small>
                {offer.currentLevel}/{offer.maximumLevel}
              </small>
            </div>
            <p>{formatEffectChange(offer)}</p>
            <button
              className="button button--quiet"
              type="button"
              disabled={
                offer.availability !== 'available' || busyUpgradeId !== null
              }
              onClick={() => void purchase(offer)}
            >
              {formatPurchaseLabel(offer, busyUpgradeId)}
            </button>
          </article>
        ))}
      </div>
      {message && <p className="upgrade-shop__message">{message}</p>}
    </section>
  )
}

function formatEffectChange(offer: PermanentUpgradeShopOffer): string {
  const current = formatEffectValue(offer.lane, offer.currentValue)
  if (offer.nextValue === null) return `目前：${current}`
  return `${current} → ${formatEffectValue(offer.lane, offer.nextValue)}`
}

function formatEffectValue(
  lane: PermanentUpgradeShopOffer['lane'],
  value: number | boolean,
): string {
  if (lane === 'equipmentSlots') return `${value} 格`
  return value === false ? '未解鎖' : `每 ${(Number(value) / 1_000).toFixed(1)} 秒`
}

function formatPurchaseLabel(
  offer: PermanentUpgradeShopOffer,
  busyUpgradeId: PermanentUpgradeId | null,
): string {
  if (busyUpgradeId === offer.purchaseId) return '保存中…'
  if (offer.availability === 'maximumLevel') return '已達最高級'
  if (offer.costGold === null) return '已達最高級'
  if (offer.availability === 'insufficientGold') {
    return `需要 ${offer.costGold} G`
  }
  return `購買 ${offer.costGold} G`
}

function purchaseStatusMessage(status: PermanentUpgradePurchaseStatus): string {
  switch (status) {
    case 'purchased':
      return '升級完成，將從下一局生效。'
    case 'insufficientGold':
      return '金幣不足。'
    case 'maximumLevel':
      return '這項升級已達最高級。'
    case 'prerequisiteNotMet':
      return '必須先解鎖懸停自動攻擊。'
  }
}
