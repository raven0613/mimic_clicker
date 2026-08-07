import normalImageUrl from '../../assets/mimic/normal.png'
import rare1ImageUrl from '../../assets/mimic/rare1.png'
import rare2ImageUrl from '../../assets/mimic/rare2.png'
import type { MimicId } from '../../types/game'

const mimicImageUrls: Record<MimicId, string> = {
  normal: normalImageUrl,
  rare1: rare1ImageUrl,
  rare2: rare2ImageUrl,
}

interface UnlockModalProps {
  mimicId: MimicId
  onAcknowledge: () => void
  busy: boolean
}

export function UnlockModal({ mimicId, onAcknowledge, busy }: UnlockModalProps) {
  return (
    <div className="overlay overlay--blocking">
      <section className="panel unlock-panel">
        <p className="eyebrow">NEW MIMIC UNLOCKED</p>
        <img src={mimicImageUrls[mimicId]} alt={`${mimicId} 寶箱怪`} />
        <h2>{mimicId.toUpperCase()}</h2>
        <p>已加入普通生成池與 Jackpot 偽裝池。</p>
        <button
          className="button button--primary"
          type="button"
          onClick={onAcknowledge}
          disabled={busy}
        >
          {busy ? '保存中…' : '收下解鎖'}
        </button>
      </section>
    </div>
  )
}
