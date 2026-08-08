# Mimic Clicker

桌面瀏覽器優先的 Active Clicker 原型。玩家在限時內敲碎由上往下流動的寶箱，找出偽裝 Jackpot，並在揭露後的短時間追逐中擊破它。

遊戲規格由 [doc/spec.md](./doc/spec.md) 進入；第一階段實作範圍見 [doc/initial_release.md](./doc/initial_release.md)。

## 環境

- Node.js 20
- npm

```bash
nvm use 20
npm install
```

## 開發

```bash
npm run dev
```

應用會先載入 IndexedDB 存檔與 PixiJS 資源，完成後由玩家按下開始按鈕開局。

## 驗證

```bash
npm run test:run
npm run test:balance
npm run lint
npm run build
```

- 自動化測試只涵蓋核心邏輯、流程、存檔與固定 seed 平衡模擬。
- React 排版、SCSS 與純視覺動畫不做 UI 自動化測試，需依規格進行人工體感確認。
