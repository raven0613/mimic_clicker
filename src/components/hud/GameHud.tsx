import { jackpotConfig } from '../../configs/jackpotConfig'
import { roundConfig } from '../../configs/roundConfig'
import type { HudSnapshot } from '../../store/gameStore'
import { TimerBar } from './TimerBar'

interface GameHudProps {
  hud: HudSnapshot
}

export function GameHud({ hud }: GameHudProps) {
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
        <span>Gold +{hud.roundGold}</span>
        <span>Breaks {hud.defeatedMimics}</span>
      </div>
    </div>
  )
}
