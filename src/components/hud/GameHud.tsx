import { useLayoutEffect, useRef } from 'react'

import goldCoinImageUrl from '../../assets/coin/gold_coin_idle.png'
import { jackpotConfig } from '../../configs/jackpotConfig'
import { roundConfig } from '../../configs/roundConfig'
import type { HudSnapshot } from '../../store/gameStore'
import type { Vector2 } from '../../types/game'
import type { EquipmentCollectionTargets } from '../../types/game'
import { EquipmentHud } from './EquipmentHud'
import { RollingGoldCounter } from './RollingGoldCounter'
import { TimerBar } from './TimerBar'

interface GameHudProps {
  hud: HudSnapshot
  onGoldTargetChange: (target: Vector2 | null) => void
  onEquipmentTargetsChange: (targets: EquipmentCollectionTargets) => void
}

export function GameHud({
  hud,
  onGoldTargetChange,
  onEquipmentTargetsChange,
}: GameHudProps) {
  const goldTargetRef = useRef<HTMLImageElement>(null)

  useLayoutEffect(() => {
    const goldTarget = goldTargetRef.current
    if (!goldTarget) return

    const reportTarget = () => {
      const bounds = goldTarget.getBoundingClientRect()
      onGoldTargetChange({
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2,
      })
    }
    reportTarget()
    const resizeObserver = new ResizeObserver(reportTarget)
    resizeObserver.observe(goldTarget)
    window.addEventListener('resize', reportTarget)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', reportTarget)
      onGoldTargetChange(null)
    }
  }, [onGoldTargetChange])

  return (
    <div className="hud">
      <div className="hud__top">
        <TimerBar
          label="ROUND"
          remainingMs={hud.mainRemainingMs}
          durationMs={roundConfig.durationMs}
          variant="main"
        />
        {hud.jackpotRemainingMs !== null && (
          <TimerBar
            label="JACKPOT ESCAPE"
            remainingMs={hud.jackpotRemainingMs}
            durationMs={jackpotConfig.chaseDurationMs}
            variant="jackpot"
          />
        )}
      </div>
      <div className="hud__stats">
        <span className="hud__stat hud__gold">
          <img
            className="hud__gold-target"
            src={goldCoinImageUrl}
            alt=""
            ref={goldTargetRef}
          />
          <span className="hud__stat-label">Gold</span>
          <RollingGoldCounter value={hud.presentedRoundGold} />
        </span>
        <span className="hud__stat">
          <span className="hud__stat-label">Breaks</span>
          {hud.defeatedMimics}
        </span>
      </div>
      <EquipmentHud onTargetsChange={onEquipmentTargetsChange} />
    </div>
  )
}
