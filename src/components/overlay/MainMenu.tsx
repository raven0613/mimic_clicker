import type { ProgressData } from '../../types/game'
import { SaveControls } from '../save/SaveControls'

interface MainMenuProps {
  progress: ProgressData
  onStart: () => void
  onImport: (code: string) => Promise<void>
  onReset: () => Promise<void>
  onExport: () => string
}

export function MainMenu({
  progress,
  onStart,
  onImport,
  onReset,
  onExport,
}: MainMenuProps) {
  return (
    <div className="overlay overlay--menu">
      <section className="panel main-menu">
        <p className="eyebrow">ACTIVE CLICKER PROTOTYPE</p>
        <h1>Mimic Clicker</h1>
        <div className="career-stats">
          <div><small>完成局數</small><strong>{progress.completedRounds}</strong></div>
          <div><small>總金幣</small><strong>{progress.gold}</strong></div>
          <div><small>已解鎖</small><strong>{progress.unlockedMimicIds.length}/3</strong></div>
        </div>
        <button className="button button--primary" type="button" onClick={onStart}>
          開始一局
        </button>
        <SaveControls
          onExport={onExport}
          onImport={onImport}
          onReset={onReset}
        />
      </section>
    </div>
  )
}
