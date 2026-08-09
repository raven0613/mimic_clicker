import { useEffect, useState } from 'react'

import { animationConfig } from '../../configs/animationConfig'
import { equipmentDefinitions } from '../../configs/equipmentConfig'
import type { RoundResult } from '../../types/game'
import { RollingGoldCounter } from '../hud/RollingGoldCounter'

interface SettlementModalProps {
  result: RoundResult
  onContinue: () => void
}

const jackpotOutcomeText: Record<RoundResult['jackpotOutcome'], string> = {
  notRevealed: '未揭露',
  defeated: '成功擊破',
  escaped: '已逃脫',
  roundExpiredDuringChase: '隨本局結束逃脫',
}

const equipmentNameById = new Map(
  equipmentDefinitions.map(({ id, displayName }) => [id, displayName]),
)

export function SettlementModal({ result, onContinue }: SettlementModalProps) {
  const groupCount = result.equipmentSales.length
  const skipsSaleReveal = groupCount === 0
  const [revealedGroupCount, setRevealedGroupCount] = useState(0)
  const [showTotal, setShowTotal] = useState(skipsSaleReveal)
  const [isComplete, setIsComplete] = useState(skipsSaleReveal)
  const [isFastForwarded, setIsFastForwarded] = useState(false)

  useEffect(() => {
    if (skipsSaleReveal || isFastForwarded) return
    const config = animationConfig.settlementEquipmentSale
    const revealIntervalMs = Math.min(
      config.groupRevealIntervalMs,
      config.maximumGroupRevealDurationMs / groupCount,
    )
    const timeoutIds = result.equipmentSales.map((_, index) =>
      window.setTimeout(
        () => setRevealedGroupCount(index + 1),
        revealIntervalMs * (index + 1),
      ),
    )
    const revealDurationMs = revealIntervalMs * groupCount
    timeoutIds.push(
      window.setTimeout(() => setShowTotal(true), revealDurationMs),
      window.setTimeout(
        () => setIsComplete(true),
        revealDurationMs + config.totalGoldRollDurationMs,
      ),
    )
    return () => timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId))
  }, [groupCount, isFastForwarded, result.equipmentSales, skipsSaleReveal])

  function fastForward(): void {
    if (isComplete) return
    setIsFastForwarded(true)
    setRevealedGroupCount(groupCount)
    setShowTotal(true)
    setIsComplete(true)
  }

  function handlePrimaryAction(): void {
    if (isComplete) onContinue()
    else fastForward()
  }

  return (
    <div className="overlay overlay--blocking" onClick={fastForward}>
      <section className="panel result-panel">
        <p className="eyebrow">ROUND COMPLETE</p>
        <h2>本局結算</h2>
        <dl className="result-list">
          <div><dt>戰鬥收益</dt><dd>+{result.combatGold}</dd></div>
          {result.equipmentSales
            .slice(0, revealedGroupCount)
            .map((sale) => (
              <div className="result-list__sale" key={sale.equipmentId}>
                <dt>{equipmentNameById.get(sale.equipmentId)} × {sale.quantity}</dt>
                <dd>+{sale.subtotalGold}</dd>
              </div>
            ))}
          {groupCount > 0 && (
            <div className="result-list__sale-total">
              <dt>裝備出售</dt>
              <dd>+{showTotal ? result.equipmentSaleGold : '—'}</dd>
            </div>
          )}
          <div className="result-list__grand-total">
            <dt>本局總收益</dt>
            <dd>
              +<RollingGoldCounter
                value={showTotal ? result.totalGold : result.combatGold}
                durationMs={
                  isFastForwarded
                    ? 0
                    : animationConfig.settlementEquipmentSale.totalGoldRollDurationMs
                }
                ariaLabel={`本局總收益 ${result.totalGold}`}
              />
            </dd>
          </div>
          <div><dt>擊破數</dt><dd>{result.defeatedMimics}</dd></div>
          <div><dt>Jackpot</dt><dd>{jackpotOutcomeText[result.jackpotOutcome]}</dd></div>
        </dl>
        {!isComplete && <p className="result-panel__hint">點擊即可顯示完整結果</p>}
        <button className="button button--primary" type="button" onClick={handlePrimaryAction}>
          {isComplete ? '繼續' : '顯示完整結果'}
        </button>
      </section>
    </div>
  )
}
