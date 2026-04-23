# 前端本機設定與 IndexedDB 持久化說明

本文說明 DCIM 前端如何將「機房雙生場景」「網路通訊設定」「介面語系」等設定寫入瀏覽器本機，以及「自動寫入 IndexedDB」的實際意義。

---

## 1. 單一儲存位置

下列資料透過 **同一個 Zustand store**（`frontend/src/store/useDcimStore.ts`）管理，並由 **`persist` middleware** 寫入 **IndexedDB**（經 `idb-keyval`），邏輯上視為**單一本機設定中心**：

| 資料類型 | 說明 |
|----------|------|
| 機櫃、落地設備、地點 | 3D 雙生場景與資產結構 |
| `currentLocationId` | 目前選取的地點 |
| `deviceCommConfigs` | 網路通訊頁的設備通訊設定（機型、Device 類型、通訊方式等） |
| `uiLanguage` | 介面語系（`zh-TW` / `en`） |

持久化時使用的 **IndexedDB 鍵名**為：`datacenter-storage-v4`（對應 Zustand `persist` 的 `name` 選項）。

---

## 2. 「自動寫入 IndexedDB」是什麼意思？

### 2.1 IndexedDB

**IndexedDB** 是瀏覽器提供的本機資料庫 API，資料留在使用者電腦上，關閉分頁或重開機後通常仍保留（除非使用者清除網站資料或更換瀏覽器／設定檔）。

本專案透過 **`idb-keyval`** 讀寫鍵值，並以 **`createJSONStorage` + 自訂 `indexedDBStorage`** 接到 Zustand 的 `persist`。

### 2.2 何謂「自動」

當程式呼叫 **`useDcimStore` 內會改變狀態的 `set`**（例如拖曳機櫃、修改通訊列、切換語系），`persist` 會依 **`partialize`** 挑出需要保存的欄位，組成快照後**在背景**寫入 IndexedDB。

因此：

- **不需要**在網路通訊頁再按一次「儲存到 localStorage」；欄位一經更新 store，就會觸發持久化流程。
- 寫入為**非同步**，一般不會阻塞主執行緒，但極高頻率連續更新仍會增加寫入次數（與一般 SPA 使用 persist 的行為相同）。

### 2.3 實際會被存進 IndexedDB 的欄位

由 `partialize` 決定，目前包含：

- `racks`、`equipments`、`locations`、`currentLocationId`
- `deviceCommConfigs`
- `uiLanguage`

**未**列入 `partialize` 的狀態（例如編輯模式 `isEditMode`、目前選中的機櫃／設備 ID）**不會**隨上述快照一併持久化，重新整理後會回到預設行為。

---

## 3. 與舊版 localStorage 的關係（遷移）

升級至「統一 IndexedDB」後，若 IndexedDB 中**尚無**有效的 `deviceCommConfigs`（或為空陣列），還原流程會嘗試讀取舊鍵：

- `dcim.network.comm.profile.v1`（舊網路通訊設定）

語系則在缺少有效 `uiLanguage` 時，嘗試讀取：

- `dcim-language`

讀取成功後會合併進 store；**新的寫入目標為 IndexedDB**，上述 localStorage 鍵不再由本流程主動更新（舊資料可仍留在本機，作為備援或手動清除對象）。

---

## 4. 未納入「單一設定中心」的項目

**登入／工作階段**（例如 `dcim.auth.session`）仍使用 **localStorage**（見 `frontend/src/shared/auth.ts`），與機房場景／通訊／語系分開存放，屬刻意區隔：工作階段與資產設定的生命週期與安全考量不同。

---

## 5. 使用上的限制與注意事項

1. **僅本機、單一瀏覽器設定檔**：換電腦、換瀏覽器、清除網站資料、無痕模式關閉後，資料不一定存在；**並非**自動同步到後端伺服器。
2. **多分頁**：IndexedDB 寫入不會觸發 `window` 的 `storage` 事件（該事件主要對應 localStorage）。同一瀏覽器內多分頁若需即時同步，須另行設計（例如 `BroadcastChannel` 或自訂事件）；目前以單頁操作為主。
3. **備份與還原**：機房場景可透過 Twins 頁面的匯出／匯入 JSON；通訊與語系則依上述 IndexedDB 快照一併保存，若需離線備份可再評估匯出格式是否擴充。

---

## 6. 相關程式位置（供維護查閱）

| 項目 | 路徑 |
|------|------|
| Store 與 persist、partialize、merge／遷移 | `frontend/src/store/useDcimStore.ts` |
| 通訊設定型別與合併／預設值 | `frontend/src/shared/networkComm.ts` |
| 網路通訊 UI（讀寫 store） | `frontend/src/app/network/page.tsx` |
| 語系（讀寫 store） | `frontend/src/shared/i18n/language.tsx` |
| Twins（訂閱 `deviceCommConfigs`） | `frontend/src/app/twins/page.tsx` |

---

*文件日期：2026-04-23*
