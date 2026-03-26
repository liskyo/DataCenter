# Agent 自動啟動指南 (開機即執行)
**日期：** 2026-03-23

在真正的機房環境中，我們絕對不可能在伺服器重開機後，還要人工連線進去打開終端機打 `python client_agent.py`。
我們必須把這隻測量溫度的小幫手變成系統底層的「背景服務 (Background Service / Daemon)」。

以下針對你閒置伺服器的兩種常見作業系統，提供讓 Agent **開機自動無腦執行**的最佳做法。

---
## 🐧 情況一：如果你的閒置伺服器是 Linux (Ubuntu / CentOS)
Linux 的世界裡，管理背景服務的老大叫做 `systemd`。我們只要寫一封信交給它即可。

**步驟 1：建立一個 Service 設定檔**
打開終端機輸入：
```bash
sudo nano /etc/systemd/system/datacenter-agent.service
```

**步驟 2：貼上設定檔內容**
請將裡面的 `User`, `WorkingDirectory`, `ExecStart` 根據你實際存放 `client_agent.py` 的路徑進行修改：
```ini
[Unit]
Description=DataCenter Monitoring Agent
After=network.target

[Service]
# 以哪個使用者的權限執行
User=ubuntu
# 你的 python 檔放在哪個資料夾
WorkingDirectory=/home/ubuntu/DataCenter
# 啟動指令 (建議用 python3 絕對路徑)
ExecStart=/usr/bin/python3 /home/ubuntu/DataCenter/client_agent.py
# 如果意外當機崩潰，自動幫我原地復活重啟
Restart=always

[Install]
WantedBy=multi-user.target
```
*(存檔並離開)*

**步驟 3：通知系統並設定開機自啟**
```bash
# 讓系統重新讀取設定檔
sudo systemctl daemon-reload

# 啟動這項服務
sudo systemctl start datacenter-agent

# 重要！設定開機自動執行
sudo systemctl enable datacenter-agent
```
完成！你隨時可以用 `sudo systemctl status datacenter-agent` 查看它有沒有在默默為你工作。

---
## 🪟 情況二：如果你的閒置伺服器是 Windows Server / Windows 10
在 Windows 下，最簡單免安裝套件的做法是使用內建的 **工作排程器 (Task Scheduler)**。

**步驟 1：寫一隻執行用的 `runner.bat`**
在你的 `client_agent.py` 同一個資料夾下，新增一個純文字檔命名為 `runner.bat`，內容為：
```bat
@echo off
cd /d "C:\你的資料夾路徑\DataCenter\"
# 使用 pythonw.exe 而不是 python.exe，這樣才不會跳出黑視窗干擾畫面
pythonw.exe client_agent.py
```

**步驟 2：匯入工作排程器**
1. 按下鍵盤 `Win` 鍵，搜尋並開啟 **工作排程器 (Task Scheduler)**。
2. 在右側點選 **建立工作 (Create Task)**。
   * **[一般] 標籤**：名稱隨便取 (例如 `DC_Agent`)。勾選 **「不論使用者登入與否均執行」** 以及 **「以最高權限執行」**。
   * **[觸發程序] 標籤**：新增一個觸發條件，選擇 **「系統啟動時 (At startup)」**。
   * **[動作] 標籤**：新增一個動作，選擇「啟動程式」。瀏覽並選擇你剛剛做的 `runner.bat`。
3. 按下確定，輸入你的 Windows 登入密碼授權。

完成！未來這台 Windows 不管有沒有人去輸入密碼登入桌面，只要它一通電開機，這隻小幫手就會在背景發送溫度和心跳給你的 Dashboard 了！
