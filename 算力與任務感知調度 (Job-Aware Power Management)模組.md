# 🧠 算力與任務感知調度 (Job-Aware Power Management) 模組

> **版本**：v1.0 | **更新日期**：2026-05-19  
> **適用範圍**：DataCenter Command Center — COMPUTEX 展場特別版

---

## 一、模組概述

本模組將傳統獨立運作的「IT 算力排程」與「廠務環境控制」兩大架構進行深度整合，實現**前饋式主動冷卻控制 (Feed-forward Control)**。

### 核心理念

| 傳統被動控制 | 本模組主動控制 |
|:------------|:-------------|
| GPU 變熱了 → CDU 才加速（反饋控制） | 任務啟動瞬間 → CDU 立即就位（前饋控制） |
| 時間常數 τ ≈ 20 秒 | 時間常數 τ ≈ 4 秒 |
| 產生明顯熱衝擊尖峰 | 溫度曲線保持平穩 |

```
傳統被動控制：    任務啟動 → GPU 發熱 → 溫度升高 → CDU 反應 → 溫度下降
                              ^^^^^^^^^ 熱衝擊尖峰

本模組主動控制：  任務啟動 → CDU 預先升流 → GPU 發熱 → 溫度保持平穩
                           ^^^^^^^^^^^^^ 前饋預調度
```

---

## 二、技術實現架構

### 系統架構圖

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                            │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Job Queue   │  │ Dual-Axis Chart  │  │  CDU Comparison  │  │
│  │  任務佇列     │  │ 算力×溫度時序圖   │  │  冷卻策略對比     │  │
│  └──────┬───────┘  └────────┬─────────┘  └────────┬─────────┘  │
│         │ Polling 2s        │ Polling 2s           │            │
├─────────┼───────────────────┼──────────────────────┼────────────┤
│         ▼                   ▼                      ▼            │
│                    Backend (FastAPI)                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Workload API Router                          │   │
│  │  GET /api/workload/jobs      → 任務清單                   │   │
│  │  GET /api/workload/timeline  → 時序資料                   │   │
│  │  POST /api/workload/dispatch → 手動派發任務               │   │
│  │  GET /api/workload/templates → 可用任務模板               │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │           WorkloadSimulator (Background Thread)           │   │
│  │  • 任務生命週期管理 (Pending → Running → Completed)       │   │
│  │  • 熱負載映射模型 (Thermal Mapping)                       │   │
│  │  • 前饋 vs 反饋冷卻模擬 (Proactive vs Reactive)           │   │
│  │  • 時序資料產生 (Timeline Generation)                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 檔案結構

```
DataCenter/
├── backend/
│   ├── services/
│   │   └── workload_service.py      ← 工作負載模擬引擎（核心）
│   ├── routers/
│   │   └── workload.py              ← API 路由端點
│   ├── core/
│   │   └── container.py             ← 服務註冊（已修改）
│   └── main.py                      ← Router 註冊（已修改）
└── frontend/
    └── src/
        ├── app/
        │   └── workload/
        │       └── page.tsx         ← 前端頁面
        └── components/
            └── Navbar.tsx           ← 導覽列（已修改，新增入口）
```

---

## 三、核心邏輯演算法

### 1. 資料整合層：排程器聯動 (Telemetry Ingestion)

**展場模擬模式**下，系統內建 `WorkloadSimulator` 自動產生逼真的 AI 訓練/推論任務。

**生產環境整合方案**（未來擴展）：

* **Kubernetes 環境**：監聽 K8s API Server 的 Pod 狀態變化，整合 Prometheus/Grafana 抓取特定命名空間下的 GPU Requests。支援 Volcano / KubeFlow 等 ML 排程器。
* **Slurm 環境**：監聽 `squeue` 與 `scontrol`，捕捉作業狀態從 `PD` (Pending) 轉為 `R` (Running) 的瞬間，並讀取提交腳本中的 GPU 數量與模型配置。

### 2. 算力與熱負載映射模型 (Thermal Mapping Model)

系統內建「模型熱特徵資料庫」，將 AI 任務的 GPU 配置轉換為預估熱負載：

```
預估熱負載 (kW) = GPU 數量 × 該模型 TDP (W) × 預估算力利用率 (MFU) ÷ 1000
```

**計算範例**：

偵測到任務為 `Llama-3-70B Pre-training`，配置 64 顆 H100 GPU：
- 單顆 TDP = 700W
- MFU = 45%
- 預估熱負載 = 64 × 700W × 0.45 ÷ 1000 = **20.16 kW**

#### 內建 GPU 熱特徵資料庫

| GPU 型號 | 單顆 TDP (W) | FP8 PFLOPS (每 8 顆) | 備註 |
|:---------|:------------|:--------------------|:-----|
| NVIDIA GB200 (Blackwell) | 1000W | 160.0 | 最新一代，雙晶片封裝 |
| NVIDIA HGX H200 | 700W | 32.0 | H100 改良版，記憶體加大 |
| NVIDIA HGX H100 | 700W | 32.0 | 當前主流 AI 訓練 GPU |
| NVIDIA HGX A100 | 400W | 5.0 | 上一代，仍廣泛部署 |
| NVIDIA L40S | 350W | 3.0 (每 4 顆) | 推論/多媒體專用 |
| AMD Instinct MI300X | 750W | 42.0 | AMD 旗艦 AI 加速器 |
| Intel Gaudi 3 | 600W | 14.0 | Intel 第三代 AI 加速器 |

### 3. 控制策略：前饋 PID 演算法 (Proactive Control Loop)

將預估的熱負載直接轉換為 CDU 的基礎輸出控制量，疊加到原有的溫度反饋 PID 控制迴路中：

```
CDU 目標轉速 = f(預估任務熱負載) + PID(目前實際出回水溫差)
```

#### 演算法偽碼

```python
# ── 主動式 (Feed-forward) ─────────────────────────
target_flow = BASE_FLOW + total_heat_kw × 1.2          # 基於熱負載的目標流量

if 偵測到任務啟動事件:
    cdu_flow += (target_flow - cdu_flow) × 0.8         # 瞬間跳躍 80%（前饋）
else:
    cdu_flow += (target_flow - cdu_flow) × (dt / 4.0)  # 平滑追蹤 (τ ≈ 4s)

gpu_temp += (heat_input - cooling_removal) × dt         # 熱平衡方程式
gpu_temp += (ambient - gpu_temp) × 0.02 × dt            # 自然散熱

# ── 被動式 (Feedback PID) ─────────────────────────
temp_error = gpu_temp - 35.0                             # 設定點 = 35°C

if temp_error > 0:                                       # 溫度超標才反應
    cdu_flow += temp_error × 0.05 × dt                   # 緩慢追蹤 (τ ≈ 20s)
else:
    cdu_flow += (BASE_FLOW - cdu_flow) × 0.01 × dt      # 緩慢回歸基準

gpu_temp += (heat_input - cooling_removal) × dt          # 相同熱源，但冷卻滯後
```

#### 兩種策略的數值對比

| 指標 | 主動式 (Feed-forward) | 被動式 (Feedback PID) |
|:-----|:---------------------|:---------------------|
| CDU 響應時機 | 任務啟動瞬間 | 溫度超過 35°C 後 |
| 時間常數 τ | ~4 秒 | ~20 秒 |
| CDU 流量跳躍幅度 | 目標值的 80%（瞬時） | 溫差 × 0.05（漸進） |
| 溫度峰值 | 低（<5°C 偏移） | 高（可達 10-15°C 尖峰） |
| 能源效率 | 精準匹配，無過冷浪費 | 超調後再回歸，浪費冷卻能耗 |

---

## 四、中控系統介面設計 (UI/UX)

### 頁面入口

導覽列新增 **「算力調度」/ "Workload"** 按鈕（🧠 BrainCircuit 圖示），位於「趨勢分析」之後。

### 頁面佈局

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🧠 算力與任務感知調度                                                  │
│    AI Workload Scheduling × Proactive Thermal Control                 │
│    ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────────┐   │
│    │32.0 PFLOP│ │ 64 GPUs  │ │19.0 kW   │ │ 3 RUN / 1 WAIT      │   │
│    └──────────┘ └──────────┘ └──────────┘ └──────────────────────┘   │
├──────────────────┬───────────────────────────────────────────────────┤
│ ▶ DISPATCH JOB   │                                                   │
│ ┌──────┐┌──────┐ │  📊 算力 × 溫度時序關聯                            │
│ │GPT-4 ││Llama │ │  ┌───────────────────────────────────────────┐   │
│ │Fine  ││3-70B │ │  │ Y1(左): PFLOPS(紫色面積) + Heat kW(橙面積) │   │
│ └──────┘└──────┘ │  │ Y2(右): GPU Temp                          │   │
│ ┌──────┐┌──────┐ │  │   ── 主動式 (綠色實線)                     │   │
│ │SD XL ││Deep  │ │  │   -- 被動式 (紅色虛線)                     │   │
│ │Batch ││Seek  │ │  │ ▶ 任務啟動標記線 (黃色垂直線)              │   │
│ └──────┘└──────┘ │  └───────────────────────────────────────────┘   │
│                  │                                                   │
│ 📋 工作負載佇列   │  💧 冷卻策略對比模擬                              │
│ ┌──────────────┐ │  ┌───────────────────────────────────────────┐   │
│ │ GPT-4 Fine   │ │  │ Y1(左): CDU Flow (LPM)                    │   │
│ │ ▓▓▓▓▓▓▓ 72%  │ │  │   ── 主動式 CDU 流量 (綠色實線)            │   │
│ │ 32×GPU 19kW  │ │  │   -- 被動式 CDU 流量 (紅色虛線)            │   │
│ │ NODE: 1-4    │ │  │ Y2(右): GPU 溫度疊加 (半透明)              │   │
│ ├──────────────┤ │  └───────────────────────────────────────────┘   │
│ │ Llama-3-70B  │ │                                                   │
│ │ ⏳ PENDING    │ │  ← 主動式：CDU 在 GPU 發熱前預先升流，溫度平穩    │
│ ├──────────────┤ │  → 被動式：CDU 等溫度升高才反應，產生熱衝擊尖峰    │
│ │ SD XL ✓ DONE │ │                                                   │
│ └──────────────┘ │                                                   │
└──────────────────┴───────────────────────────────────────────────────┘
```

### 各區塊功能說明

#### 1. 任務派發面板 (Dispatch Panel)
- 提供 8 種預設 AI 工作負載模板
- 點擊即可手動派發任務（展場互動用）
- 每個模板顯示 GPU 數量、算力(PFLOPS)、預估熱負載(kW)

#### 2. 工作負載佇列 (Job Queue)
- 即時顯示所有任務的狀態（Pending → Running → Completed）
- Running 狀態顯示進度條與分配的計算節點
- 顏色區分：🟢 Running / 🟡 Pending / 🔵 Completed / 🔴 Failed

#### 3. 算力 × 溫度時序關聯圖 (Dual-Axis Chart)
- **Y1 軸（左）**：GPU 算力輸出 (PFLOPS，紫色面積圖) + 熱負載 (kW，橙色面積圖)
- **Y2 軸（右）**：GPU 核心溫度
  - 主動式控制溫度 (綠色實線)
  - 被動式控制溫度 (紅色虛線)
- **任務啟動標記線**：當任務啟動時，圖表出現黃色垂直參考線，直觀展示冷卻響應時機

#### 4. CDU 冷卻策略對比模擬器 (Cooling Comparison)
- **Y1 軸（左）**：CDU 冷卻液流量 (LPM)
  - 主動式 CDU 流量 (綠色實線)
  - 被動式 CDU 流量 (紅色虛線)
- **Y2 軸（右）**：GPU 溫度疊加（半透明，供交叉比對）
- 底部圖例說明兩種策略的核心差異

---

## 五、內建 AI 工作負載模板

系統預設包含以下 8 種常見的 AI 工作負載，涵蓋訓練與推論兩大類：

| # | 任務名稱 | 類型 | GPU 配置 | PFLOPS | TDP/GPU | MFU | 預估熱負載 | 模擬時長 |
|:--|:---------|:-----|:---------|:-------|:--------|:----|:----------|:--------|
| 1 | GPT-4 Fine-tuning | Training | 32× H100 | 32.0 | 700W | 85% | 19.04 kW | 180s |
| 2 | Llama-3-70B Pre-training | Training | 64× H100 | 64.0 | 700W | 45% | 20.16 kW | 300s |
| 3 | Stable Diffusion XL Batch | Training | 8× A100 | 5.0 | 400W | 70% | 2.24 kW | 120s |
| 4 | ResNet-152 Inference | Inference | 4× L40S | 3.0 | 350W | 30% | 0.42 kW | 持續 |
| 5 | Gemma-2 27B SFT | Training | 16× H200 | 32.0 | 700W | 50% | 5.60 kW | 240s |
| 6 | Whisper-v3 Transcription | Inference | 4× L40S | 3.0 | 350W | 55% | 0.77 kW | 90s |
| 7 | DeepSeek-V3 LoRA | Training | 16× GB200 | 160.0 | 1000W | 40% | 6.40 kW | 200s |
| 8 | Mixtral 8x22B Serving | Inference | 8× MI300X | 42.0 | 750W | 35% | 2.10 kW | 持續 |

---

## 六、API 端點文件

### `GET /api/workload/jobs`
取得目前所有工作負載任務列表。

**回應範例**：
```json
{
  "status": "ok",
  "jobs": [
    {
      "id": "A1B2C3D4",
      "name": "GPT-4 Fine-tuning",
      "category": "training",
      "gpu_model": "8x NVIDIA HGX H100",
      "gpu_count": 32,
      "pflops": 32.0,
      "estimated_heat_kw": 19.04,
      "status": "running",
      "progress": 0.72,
      "assigned_nodes": ["SERVER-001", "SERVER-002", "SERVER-003", "SERVER-004"]
    }
  ]
}
```

### `GET /api/workload/timeline`
取得時序資料（供圖表繪製）。每 2 秒產生一筆，保留最近 120 筆。

**回應欄位**：
| 欄位 | 類型 | 說明 |
|:-----|:-----|:-----|
| `time_label` | string | 時間標籤 (HH:MM:SS) |
| `total_pflops` | float | 當前運行任務的總算力 |
| `active_gpu_count` | int | 活動 GPU 總數 |
| `active_heat_kw` | float | 預估總熱負載 (kW) |
| `proactive_gpu_temp` | float | 主動式控制下的 GPU 溫度 |
| `reactive_gpu_temp` | float | 被動式控制下的 GPU 溫度 |
| `proactive_cdu_flow` | float | 主動式 CDU 流量 (LPM) |
| `reactive_cdu_flow` | float | 被動式 CDU 流量 (LPM) |
| `job_events` | array | 該時間點的任務事件 (start/complete) |

### `POST /api/workload/dispatch`
手動派發一個新的 AI 工作負載任務。

**請求 Body**：
```json
{
  "template_index": 0
}
```

### `GET /api/workload/templates`
取得所有可用的工作負載模板清單。

---

## 七、展場操作指南

### 展示流程建議

1. **開場**：進入「算力調度」頁面，展示空閒狀態下的平穩基線
2. **互動**：邀請來賓點擊派發「GPT-4 Fine-tuning」任務
3. **觀察**：
   - 任務佇列出現 Pending → Running 狀態變化
   - 上方圖表出現黃色任務啟動標記線
   - 紫色算力面積圖隨即上升
   - 綠色實線（主動式溫度）保持平穩
   - 紅色虛線（被動式溫度）出現明顯熱衝擊尖峰
4. **說明**：「這就是前饋控制的威力——CDU 在任務啟動的瞬間就已經完成流速提升」
5. **進階**：連續派發多個大型任務，觀察系統如何智慧分配冷卻資源

### 解說要點

> 「傳統機房是『等 GPU 變熱了，CDU 才開始加速』，這中間有將近 20 秒的延遲。而我們的系統透過與 AI 排程器深度整合，能在任務啟動的**同一瞬間**就命令 CDU 泵浦加速——利用冷卻液的熱容緩衝，在 GPU 晶片將熱量傳導至液體之前，冷卻能力就已經就位。這就是**前饋控制 vs 反饋控制**的本質差距。」

---

## 八、未來擴展方向

- [ ] 整合真實 Kubernetes 叢集的 GPU 排程資訊
- [ ] 接入 Slurm / PBS 等 HPC 排程器
- [ ] 基於歷史訓練資料的 MFU 自適應學習
- [ ] CDU 控制指令的實際 Modbus/SNMP 下發
- [ ] 多機房跨區域的算力遷移與熱負載再平衡
- [ ] ESG 碳排放追蹤整合（每任務碳足跡計算）
