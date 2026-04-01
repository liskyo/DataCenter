# DataCenter CDU 液冷 3D 監控強化實作紀錄

**日期：** 115/04/01 (2026/04/01)
**功能範疇：** CDU 遙測擴充 + 3D 動態視覺化

---

## 新增檔案

| 檔案 | 功能 |
|------|------|
| `frontend/src/components/3d/CDUModel.tsx` | 全新 CDU 3D 模型元件 |
| `frontend/src/components/3d/CoolantFlow.tsx` | 冷卻液粒子流動畫元件 |

## 修改檔案

| 檔案 | 變更 |
|------|------|
| `backend/client_agent.py` | DLC 遙測欄位擴充 |
| `backend/core/container.py` | 新增漏水 & 低液位告警 |
| `frontend/src/components/3d/EquipmentModel.tsx` | CDU 型別改用 CDUModel |
| `frontend/src/app/twins/page.tsx` | 加入 CoolantFlow 渲染 |

---

## 一、遙測層擴充 (client_agent.py / container.py)

### 新增欄位

| 欄位 | 說明 |
|------|------|
| `pump_a_rpm` | A 幫浦轉速 |
| `pump_b_rpm` | B 幫浦轉速 |
| `leak_detected` | 漏水偵測旗標 (bool) |
| `reservoir_level` | 水箱液位 (%) |
| `facility_supply_temp` | 一次側（冰水）供水溫 |
| `facility_return_temp` | 一次側（冰水）回水溫 |

### 新增告警

| 代碼 | 觸發條件 |
|------|---------|
| `DLC_LEAK_DETECTED` | `leak_detected == True` |
| `DLC_LOW_RESERVOIR` | `reservoir_level < 20%` |

---

## 二、CDU 3D 模型 (CDUModel.tsx)

### 狀態對照表

| 狀態 | 條件 | 機體顏色 | Emissive | 頻率 |
|------|------|---------|---------|------|
| 正常 Normal | 全無異常 | 深藍 | 靛藍 `#06b6d4` | 慢呼吸 |
| 警告 Warning | outlet>42°C / inlet>30°C / 壓力>2.8bar | 深褐 | 琥珀 `#f59e0b` | 中速閃爍 |
| 緊急 Critical | outlet>50°C / flow<4LPM / 液位<30% | 深紅 | 紅色 `#ef4444` | 快速閃爍 |
| 漏水 Leak | `leak_detected: true` | 深紅 | 紅色 `#ef4444` | 極快閃爍 |

### 功能特色

1. **CanvasTexture 面板**：正面 3D 螢幕即時顯示 9 項液冷指標（供/回水溫、流量、壓力、雙幫浦 RPM、液位、冰水溫度）
2. **X-Ray 透視模式**：Hover 滑鼠到 CDU 上，外殼透明度降至 20%，露出內部雙水泵（依真實 RPM 旋轉）和水箱
3. **漏水緊急告警**：`leak_detected: true` 時，CDU 上方浮現閃爍紅色球體 + ⚠ LEAK DETECTED 文字
4. **邊緣光條**：頂部框架依狀態發光，強化視覺識別

---

## 三、冷卻液粒子流 (CoolantFlow.tsx)

- 沿 **CatmullRom 貝茲曲線**（弧形弓起 1.2m）在 CDU 與機架之間流動
- **供水線 (supply)**：`#38bdf8` 冰藍色粒子（CDU → Rack）
- **回水線 (return)**：`#f97316` 橘紅色粒子（Rack → CDU）
- **速度**：與 `flow_rate_lpm` 成正比（8 LPM = 基準速度；增大時明顯加速）
- 自動連接至場景中距 CDU 最近的 **3 個伺服器機架**

---

## 四、測試方式

### 觸發漏水告警
在 `client_agent.py` 的 `get_dlc_metrics()` 中，將：
```python
"leak_detected": False
```
臨時改為：
```python
"leak_detected": True
```
重啟 Agent → CDU 3D 立即切換為紅色閃爍 + 告警球體

### 觸發高溫警告
調高 `base_outlet`：
```python
base_outlet = 48.0  # 超過 42°C 警告門檻
```

### 觀察粒子流
進入 `http://127.0.0.1:9001/twins`，若場景中已有 CDU 設備與伺服器機架，即可看到藍色/橘色粒子沿弧形管線流動。
