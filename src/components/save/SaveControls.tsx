import { useState } from 'react'

import { saveConfig } from '../../configs/saveConfig'

interface SaveControlsProps {
  disabled: boolean
  onExport: () => string
  onImport: (code: string) => Promise<void>
  onReset: () => Promise<void>
}

export function SaveControls({
  disabled,
  onExport,
  onImport,
  onReset,
}: SaveControlsProps) {
  const [exportCode, setExportCode] = useState('')
  const [importCode, setImportCode] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleImport() {
    setBusy(true)
    setMessage('')
    try {
      await onImport(importCode)
      setImportCode('')
      setMessage('進度已匯入。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '匯入失敗。')
    } finally {
      setBusy(false)
    }
  }

  async function handleReset() {
    setBusy(true)
    setMessage('')
    try {
      await onReset()
      setExportCode('')
      setImportCode('')
      setMessage('進度已重置。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '重置失敗。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <details className="save-controls">
      <summary>存檔轉移與重置</summary>
      <div className="save-controls__body">
        <button
          type="button"
          className="button button--quiet"
          disabled={disabled || busy}
          onClick={() => setExportCode(onExport())}
        >
          產生匯出碼
        </button>
        {exportCode && <textarea readOnly value={exportCode} aria-label="進度匯出碼" />}
        <textarea
          value={importCode}
          onChange={(event) => setImportCode(event.target.value)}
          maxLength={saveConfig.maximumImportCodeLength}
          placeholder="貼上進度匯出碼"
          aria-label="進度匯入碼"
        />
        <button
          type="button"
          className="button button--quiet"
          disabled={disabled || busy || importCode.trim().length === 0}
          onClick={() => void handleImport()}
        >
          匯入並取代進度
        </button>
        <button
          type="button"
          className="button button--danger"
          disabled={disabled || busy}
          onClick={() => void handleReset()}
        >
          Reset 全部進度
        </button>
        {message && <p className="save-controls__message" role="status">{message}</p>}
      </div>
    </details>
  )
}
