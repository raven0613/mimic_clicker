import { useMachine } from '@xstate/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import './App.scss'
import { backpackConfig } from './configs/backpackConfig'
import type { WeaponId } from './configs/weaponConfig'
import { GameCanvas } from './components/game/GameCanvas'
import { GameHud } from './components/hud/GameHud'
import { MainMenu } from './components/overlay/MainMenu'
import { SettlementModal } from './components/overlay/SettlementModal'
import { StatusOverlay } from './components/overlay/StatusOverlay'
import { UnlockModal } from './components/overlay/UnlockModal'
import { PixiGameRuntime } from './service/game/PixiGameRuntime'
import type { MoveEquipmentCommand } from './service/game/equipment/equipmentState'
import { acknowledgeUnlock, completeRound, getAvailableMimicIds } from './service/progression/progression'
import {
  purchasePermanentUpgrade,
  type PermanentUpgradePurchaseStatus,
} from './service/progression/permanentUpgrades'
import {
  createRoundProgressionSnapshot,
  equipWeapon,
  purchaseWeapon,
  type WeaponEquipStatus,
  type WeaponPurchaseStatus,
} from './service/progression/weaponProgression'
import { decodeProgress, encodeProgress } from './service/save/saveCodec'
import { createSaveRepository } from './service/save/saveRepository'
import { gameFlowMachine } from './state/gameFlowMachine'
import { useGameStore } from './store/gameStore'
import type {
  EquipmentCollectionTargets,
  PermanentUpgradeId,
  ProgressData,
  RoundProgressionSnapshot,
  RoundResult,
  Vector2,
} from './types/game'

const saveRepository = createSaveRepository()
type FailedOperation = 'boot' | 'settlement' | 'unlock'

function App() {
  const [flow, send] = useMachine(gameFlowMachine)
  const [runtime, setRuntime] = useState<PixiGameRuntime | null>(null)
  const [loadedProgress, setLoadedProgress] = useState<ProgressData | null>(null)
  const [roundProgression, setRoundProgression] =
    useState<RoundProgressionSnapshot | null>(null)
  const [unlockSaveBusy, setUnlockSaveBusy] = useState(false)
  const [growthSaveBusy, setGrowthSaveBusy] = useState(false)
  const [failedOperation, setFailedOperation] = useState<FailedOperation>('boot')
  const bootSent = useRef(false)
  const settlementWriteInProgress = useRef(false)
  const growthWriteInProgress = useRef(false)
  const progress = useGameStore((state) => state.progress)
  const hud = useGameStore((state) => state.hud)
  const equipment = useGameStore((state) => state.equipment)
  const latestRoundResult = useGameStore((state) => state.latestRoundResult)
  const hydrateProgress = useGameStore((state) => state.hydrateProgress)
  const updateHud = useGameStore((state) => state.updateHud)
  const updateEquipment = useGameStore((state) => state.updateEquipment)
  const setLatestRoundResult = useGameStore((state) => state.setLatestRoundResult)

  useEffect(() => {
    void saveRepository
      .loadOrCreate()
      .then(setLoadedProgress)
      .catch((error: unknown) => {
        setFailedOperation('boot')
        send({
          type: 'BOOT_FAILED',
          errorMessage:
            error instanceof Error ? error.message : 'Unable to load progress',
        })
      })
  }, [send])

  useEffect(() => {
    if (!runtime || !loadedProgress || bootSent.current) return
    bootSent.current = true
    hydrateProgress(loadedProgress)
    runtime.setDecorativePool(getAvailableMimicIds(loadedProgress))
    send({
      type: 'BOOT_SUCCEEDED',
      hasPendingUnlock: loadedProgress.pendingUnlockMimicIds.length > 0,
    })
  }, [hydrateProgress, loadedProgress, runtime, send])

  const isBackpackOpen = flow.matches({
    playing: { backpack: 'open' },
  })

  useLayoutEffect(() => {
    runtime?.setGameplayPaused(
      isBackpackOpen && backpackConfig.pauseGameWhileOpen,
    )
  }, [isBackpackOpen, runtime])

  useEffect(() => {
    if (
      !flow.matches('savingSettlement') ||
      !latestRoundResult ||
      settlementWriteInProgress.current
    ) {
      return
    }
    settlementWriteInProgress.current = true
    const settlement = completeRound(progress, latestRoundResult)

    void saveRepository
      .replace(settlement.progress)
      .then(() => {
        hydrateProgress(settlement.progress)
        runtime?.setDecorativePool(getAvailableMimicIds(settlement.progress))
        send({
          type: 'SETTLEMENT_SAVED',
          hasPendingUnlock:
            settlement.progress.pendingUnlockMimicIds.length > 0,
        })
      })
      .catch((error: unknown) => {
        setFailedOperation('settlement')
        send({
          type: 'SAVE_FAILED',
          errorMessage:
            error instanceof Error ? error.message : 'Unable to save settlement',
        })
      })
      .finally(() => {
        settlementWriteInProgress.current = false
      })
  }, [flow, hydrateProgress, latestRoundResult, progress, runtime, send])

  function startRound() {
    if (!runtime || growthWriteInProgress.current) return
    const progression = createRoundProgressionSnapshot(progress)
    setLatestRoundResult(null)
    setRoundProgression(progression)
    runtime.startRound(getAvailableMimicIds(progress), progression)
    send({ type: 'START_ROUND' })
  }

  async function purchaseUpgrade(
    upgradeId: PermanentUpgradeId,
  ): Promise<PermanentUpgradePurchaseStatus> {
    const purchase = purchasePermanentUpgrade(progress, upgradeId)
    if (purchase.status !== 'purchased') return purchase.status
    await saveGrowthProgress(
      purchase.progress,
      `無法保存永久升級「${upgradeId}」。`,
    )
    return purchase.status
  }

  async function purchaseMainWeapon(
    weaponId: WeaponId,
  ): Promise<WeaponPurchaseStatus> {
    const purchase = purchaseWeapon(progress, weaponId)
    if (purchase.status !== 'purchased') return purchase.status
    await saveGrowthProgress(
      purchase.progress,
      `無法保存主武器購買「${weaponId}」。`,
    )
    return purchase.status
  }

  async function equipMainWeapon(
    weaponId: WeaponId,
  ): Promise<WeaponEquipStatus> {
    const equipmentResult = equipWeapon(progress, weaponId)
    if (equipmentResult.status !== 'equipped') return equipmentResult.status
    await saveGrowthProgress(
      equipmentResult.progress,
      `無法保存主武器切換「${weaponId}」。`,
    )
    return equipmentResult.status
  }

  async function saveGrowthProgress(
    nextProgress: ProgressData,
    errorMessage: string,
  ): Promise<void> {
    if (growthWriteInProgress.current) {
      throw new Error('另一筆局外成長正在保存，請稍後再試。')
    }
    growthWriteInProgress.current = true
    setGrowthSaveBusy(true)
    try {
      await saveRepository.replace(nextProgress)
      hydrateProgress(nextProgress)
    } catch (error) {
      throw new Error(errorMessage, { cause: error })
    } finally {
      growthWriteInProgress.current = false
      setGrowthSaveBusy(false)
    }
  }

  function handleRoundCompleted(result: RoundResult) {
    setLatestRoundResult(result)
    send({ type: 'ROUND_COMPLETED' })
  }

  const handleGoldTargetChange = useCallback(
    (target: Vector2 | null) => runtime?.setRewardCollectionTarget(target),
    [runtime],
  )
  const handleEquipmentTargetsChange = useCallback(
    (targets: EquipmentCollectionTargets) =>
      runtime?.setEquipmentCollectionTargets(targets),
    [runtime],
  )
  const handleMoveEquipment = useCallback(
    (command: MoveEquipmentCommand) => runtime?.moveEquipment(command),
    [runtime],
  )

  async function acknowledgeCurrentUnlock() {
    const mimicId = progress.pendingUnlockMimicIds[0]
    if (!mimicId || unlockSaveBusy) return
    setUnlockSaveBusy(true)
    const updated = acknowledgeUnlock(progress, mimicId)
    try {
      await saveRepository.replace(updated)
      hydrateProgress(updated)
      send({
        type: 'UNLOCK_ACKNOWLEDGED',
        hasPendingUnlock: updated.pendingUnlockMimicIds.length > 0,
      })
    } catch (error) {
      setFailedOperation('unlock')
      send({
        type: 'SAVE_FAILED',
        errorMessage:
          error instanceof Error ? error.message : 'Unable to acknowledge unlock',
      })
    } finally {
      setUnlockSaveBusy(false)
    }
  }

  async function importProgress(code: string) {
    const imported = decodeProgress(code)
    if (!window.confirm('匯入會完整取代目前進度，確定繼續？')) {
      throw new Error('已取消匯入。')
    }
    await saveRepository.replace(imported)
    hydrateProgress(imported)
    runtime?.resetToIdle()
    send({
      type: 'PROGRESS_RELOADED',
      hasPendingUnlock: imported.pendingUnlockMimicIds.length > 0,
    })
  }

  async function resetProgress() {
    if (!window.confirm('這會清除全部進度，且無法從本機自動復原。確定 Reset？')) {
      throw new Error('已取消重置。')
    }
    const reset = await saveRepository.reset()
    hydrateProgress(reset)
    runtime?.resetToIdle()
    send({ type: 'PROGRESS_RELOADED', hasPendingUnlock: false })
  }

  const pendingUnlock = progress.pendingUnlockMimicIds[0]
  const postRoundOverlay =
    flow.matches('savingSettlement') ||
    flow.matches('settlement') ||
    flow.matches('unlockAnnouncement')

  function retryFailedOperation() {
    if (failedOperation === 'settlement') {
      send({ type: 'RETRY_SETTLEMENT' })
    } else if (failedOperation === 'unlock') {
      send({ type: 'RETRY_UNLOCK' })
    } else {
      window.location.reload()
    }
  }

  return (
    <main
      className={`game-shell${postRoundOverlay ? ' game-shell--blurred' : ''}${
        isBackpackOpen && backpackConfig.pauseGameWhileOpen
          ? ' game-shell--gameplay-paused'
          : ''
      }`}
    >
      <GameCanvas
        onReady={setRuntime}
        onInitializationError={(error) =>
          {
            setFailedOperation('boot')
            send({ type: 'BOOT_FAILED', errorMessage: error.message })
          }
        }
        onHudSnapshot={updateHud}
        onEquipmentSnapshot={updateEquipment}
        onJackpotDisguised={() => send({ type: 'JACKPOT_RETURNED' })}
        onJackpotWaitingToReturn={() =>
          send({ type: 'JACKPOT_LEFT_DISGUISED' })
        }
        onJackpotRevealed={() => send({ type: 'JACKPOT_REVEALED' })}
        onJackpotResolved={() => send({ type: 'JACKPOT_RESOLVED' })}
        onRoundFinishing={() => send({ type: 'ROUND_TIMER_EXPIRED' })}
        onRoundCompleted={handleRoundCompleted}
      />

      {flow.matches('playing') && roundProgression && (
        <GameHud
          hud={hud}
          equipment={equipment}
          isBackpackOpen={isBackpackOpen}
          onToggleBackpack={() =>
            send({
              type: isBackpackOpen ? 'CLOSE_BACKPACK' : 'OPEN_BACKPACK',
            })
          }
          onCloseBackpack={() => send({ type: 'CLOSE_BACKPACK' })}
          onMoveEquipment={handleMoveEquipment}
          onGoldTargetChange={handleGoldTargetChange}
          onEquipmentTargetsChange={handleEquipmentTargetsChange}
        />
      )}
      {flow.matches('loadingSave') && (
        <StatusOverlay title="載入中" message="正在準備存檔與遊戲資源…" />
      )}
      {flow.matches('ready') && (
        <MainMenu
          progress={progress}
          growthSaveBusy={growthSaveBusy}
          onStart={startRound}
          onExport={() => encodeProgress(progress)}
          onImport={importProgress}
          onReset={resetProgress}
          onPurchaseUpgrade={purchaseUpgrade}
          onPurchaseWeapon={purchaseMainWeapon}
          onEquipWeapon={equipMainWeapon}
        />
      )}
      {flow.matches('savingSettlement') && (
        <StatusOverlay title="保存結算" message="正在安全寫入本局進度…" />
      )}
      {flow.matches('settlement') && latestRoundResult && (
        <SettlementModal
          result={latestRoundResult}
          onContinue={() => send({ type: 'CONTINUE' })}
        />
      )}
      {flow.matches('unlockAnnouncement') && pendingUnlock && (
        <UnlockModal
          mimicId={pendingUnlock}
          onAcknowledge={() => void acknowledgeCurrentUnlock()}
          busy={unlockSaveBusy}
        />
      )}
      {flow.matches('error') && (
        <StatusOverlay
          title="進度處理失敗"
          message={flow.context.errorMessage ?? '發生未知錯誤，請重新整理後再試。'}
          actionLabel={failedOperation === 'boot' ? '重新載入' : '重試'}
          onAction={retryFailedOperation}
        />
      )}
    </main>
  )
}

export default App
