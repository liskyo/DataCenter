# DataCenter LINE Notify 警報通知設定指南 (初學者友善版)

本指南將帶領你一步步在 DataCenter 專案中開啟 LINE 警報功能，讓機房異常時手機第一時間收到通知。

---

## 🚀 第一步：申請 LINE Notify 存取令牌 (Token)

請跟著以下步驟獲取你的專屬 Token：

1.  **登入服務**：存取 [LINE Notify 官方網站](https://notify-bot.line.me/zh_TW/) 並點擊右上角「登入」。
2.  **進入個人頁面**：登入後點擊右上角你的名字，選擇 **「個人頁面 (My Page)」**。
3.  **發行權杖**：在下方找到「發行權杖」按鈕。
4.  **設定名稱與接收對象**：
    *   **權杖名稱**：輸入 `DataCenter-警報` (這會顯示在訊息開頭)。
    *   **接收對象**：
        *   若要自己接收：選擇「透過 1 對 1 聊天接收 LINE Notify 的通知」。
        *   若要群組接收：選擇對應的群組 (記得之後要把 `LINE Notify` 機器人拉進該群組)。
5.  **複製 Token**：點擊「發行」後，系統會顯示一串長長的代碼。**請立即複製並妥善保存** (關閉視窗後就看不到了！)。

---

## 🛠️ 第二步：將 Token 套用至專案

根據你的運行環境，選擇一種方式設定：

### 1. 本地開發測試 (Local)
打開 `backend/core/container.py`，找到 `AppSettings` 類別，將你的 Token 貼上：
```python
@dataclass
class AppSettings:
    # ... 其他設定 ...
    line_notify_token: str = "這裡貼上你的 TOKEN"
```

### 2. 雲端部署環境 (Render / Vercel)
在雲端服務的 **Environment Variables** 面板中增加一個變數：
- **Key**: `LINE_NOTIFY_TOKEN` (如果你的專案有讀取環境變數的機制)
- **Value**: `你的 TOKEN 代碼`

---

## 🧪 第三步：驗證通知功能

我已經在專案根目錄準備了一個測試腳本 `test_line_notify.py`。

1.  開啟終端機 (PowerShell / CMD)。
2.  執行指令：
    ```powershell
    python test_line_notify.py
    ```
3.  按提示輸入你的 Token，檢查手機 LINE 訊息：
    -   ✅ **成功**：你會收到兩則訊息（第一則警報與第三則不同類型的警報）。
    -   🚫 **過濾**：第二則重複的訊息會顯示 `[Notifier] Throttled alert...`，代表「重複警報過濾」功能生效。

---

## ⚙️ 進階：調整警報發送頻率

如果你覺得警報發得太勤，或是想縮短間隔，可以修改 `backend/services/notification_service.py`：

```python
# 修改 cooldown_seconds 參數 (單位為秒)
# 例如 600 代表同一種錯誤在 10 分鐘內只會發一次 LINE
class NotificationService:
    def __init__(self, token: str, cooldown_seconds: int = 300):
        # ...
```

---

> [!IMPORTANT]
> **重要叮嚀**：
> 如果你選擇發送到「群組」，請務必回到手機 LINE App，進入該群組並點擊「邀請」，搜尋並加入 **「LINE Notify」** 這個官方帳號。否則即使 Token 密碼正確，訊息也發不進去喔！
