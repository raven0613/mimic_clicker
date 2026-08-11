import type { PermanentUpgradeId, ProgressData } from '../../types/game'
import type { WeaponId } from '../../configs/weaponConfig'
import { SaveControls } from '../save/SaveControls'
import { PermanentUpgradeShop } from '../upgrade/PermanentUpgradeShop'
import type { PermanentUpgradePurchaseStatus } from '../../service/progression/permanentUpgrades'
import type {
  WeaponEquipStatus,
  WeaponPurchaseStatus,
} from '../../service/progression/weaponProgression'
import { WeaponShop } from '../weapon/WeaponShop'

interface MainMenuProps {
  progress: ProgressData
  growthSaveBusy: boolean
  onStart: () => void
  onImport: (code: string) => Promise<void>
  onReset: () => Promise<void>
  onExport: () => string
  onPurchaseUpgrade: (
    upgradeId: PermanentUpgradeId,
  ) => Promise<PermanentUpgradePurchaseStatus>
  onPurchaseWeapon: (weaponId: WeaponId) => Promise<WeaponPurchaseStatus>
  onEquipWeapon: (weaponId: WeaponId) => Promise<WeaponEquipStatus>
}

export function MainMenu({
  progress,
  growthSaveBusy,
  onStart,
  onImport,
  onReset,
  onExport,
  onPurchaseUpgrade,
  onPurchaseWeapon,
  onEquipWeapon,
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
        <button
          className="button button--primary"
          type="button"
          disabled={growthSaveBusy}
          onClick={onStart}
        >
          開始一局
        </button>
        <WeaponShop
          progress={progress}
          disabled={growthSaveBusy}
          onPurchase={onPurchaseWeapon}
          onEquip={onEquipWeapon}
        />
        <PermanentUpgradeShop
          progress={progress}
          disabled={growthSaveBusy}
          onPurchase={onPurchaseUpgrade}
        />
        <SaveControls
          disabled={growthSaveBusy}
          onExport={onExport}
          onImport={onImport}
          onReset={onReset}
        />
      </section>
    </div>
  )
}
