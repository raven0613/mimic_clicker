import type { RoundResult } from '../../types/game'

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

export function SettlementModal({ result, onContinue }: SettlementModalProps) {
  return (
    <div className="overlay overlay--blocking">
      <section className="panel result-panel">
        <p className="eyebrow">ROUND COMPLETE</p>
        <h2>本局結算</h2>
        <dl className="result-list">
          <div><dt>獲得金幣</dt><dd>+{result.earnedGold}</dd></div>
          <div><dt>擊破數</dt><dd>{result.defeatedMimics}</dd></div>
          <div><dt>Jackpot</dt><dd>{jackpotOutcomeText[result.jackpotOutcome]}</dd></div>
        </dl>
        <button className="button button--primary" type="button" onClick={onContinue}>
          繼續
        </button>
      </section>
    </div>
  )
}
