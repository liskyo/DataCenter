# -*- coding: utf-8 -*-
"""
Robust Unit Tests for Immersion Cooling Telemetry and Closed-loop Self-healing.
Strictly PEP 8 compliant, using standard python unittest library.
"""

from __future__ import annotations
import unittest
import time
from unittest.mock import MagicMock
from services.immersion_service import ImmersionCoolingService, TwoPhaseEngine


class TestImmersionCoolingService(unittest.TestCase):
    def setUp(self) -> None:
        self.service = ImmersionCoolingService()
        self.tank_id = "IMM-TP-001"
        self.base_data = {
            "server_id": self.tank_id,
            "type": "immersion_dual",
            "power_kw": 15.0,
            "temperature": 45.0,
            "pressure_kpa": 101.3,
            "fluid_level_mm": 480.0,
            "filter_dp_psi": 2.2,
            "conductivity_us_cm": 0.08,
            "ph_value": 7.2,
            "water_content_ppm": 8.0
        }

    def test_void_fraction_nucleate_boiling(self) -> None:
        """測試正常核沸騰狀態下，Void Fraction 應在合理區間，boiling_regime 應為 nucleate"""
        gpu_power = 15.0  # 15 kW
        gpu_temp = 55.0
        pressure = 101.3
        
        # 直接測試 TwoPhaseEngine 實例方法
        engine = TwoPhaseEngine(self.tank_id)
        void_fraction, regime, should_throttle = engine._calculate_void_fraction(
            gpu_power, gpu_temp, pressure
        )
        
        self.assertGreater(void_fraction, 0.0)
        self.assertLess(void_fraction, 35.0)
        self.assertEqual(regime, "nucleate")
        self.assertFalse(should_throttle)

    def test_void_fraction_film_boiling_chf(self) -> None:
        """測試極高功率下的臨界乾涸 (CHF) 狀態，應觸發 Film Boiling 與 throttling 降頻信號"""
        gpu_power = 85.0  # 85 kW 極高功率
        gpu_temp = 85.0
        pressure = 101.3
        
        # 直接測試 TwoPhaseEngine 實例方法
        engine = TwoPhaseEngine(self.tank_id)
        void_fraction, regime, should_throttle = engine._calculate_void_fraction(
            gpu_power, gpu_temp, pressure
        )
        
        self.assertGreaterEqual(void_fraction, 45.0)
        self.assertEqual(regime, "film")
        self.assertTrue(should_throttle)

    def test_fluid_loss_rate_normal_vs_leak(self) -> None:
        """測試液體流失率：正常運行與手動覆寫密封破損洩漏之對比"""
        # 1. 正常狀態下微幅流失
        self.service.process_immersion_telemetry(self.tank_id, self.base_data, [])
        self.assertLess(self.base_data["fused_loss_rate_ml_hr"], 5.0)
        self.assertEqual(self.base_data["leak_severity"], "normal")
        
        # 2. 模擬觀眾調控覆寫密封洩漏
        self.service.set_simulator_override(self.tank_id, {"seal_leak": True})
        
        # 模擬多次時序累積
        for _ in range(5):
            self.service.process_immersion_telemetry(self.tank_id, self.base_data, [])
            
        self.assertGreaterEqual(self.base_data["fused_loss_rate_ml_hr"], 50.0)
        self.assertEqual(self.base_data["leak_severity"], "critical")

    def test_chemical_degradation_and_purification_bypass(self) -> None:
        """測試化學性質劣化與自癒系統 (線上淨化) 的閉環調控"""
        # 模擬水氣入侵
        self.service.set_simulator_override(self.tank_id, {"water_intrusion": True})
        
        # 經過多次 telemetry 處理，模擬酸化裂解
        for _ in range(10):
            self.service.process_immersion_telemetry(self.tank_id, self.base_data, [])
            
        # 酸化後應觸發化學腐蝕風險警告，且線上淨化應啟動
        self.assertIn(self.base_data["chem_severity"], ["warning", "critical"])
        self.assertIn(self.base_data["purification_state"], ["active_bypass", "active_full"])

    def test_closed_loop_self_healing_maintenance_ticket(self) -> None:
        """測試壓差過濾器剩餘天數低於警告值時，自癒系統是否自動向維護服務發起更換工單"""
        # 模擬濾芯高度堵塞
        self.service.set_simulator_override(self.tank_id, {"clogged_filter": True})
        
        # 建立具有動態持久化模擬能力的 Mock 維護服務
        schedules_list = []
        mock_maintenance = MagicMock()
        mock_maintenance.list_schedules.side_effect = lambda: schedules_list
        mock_maintenance.create_schedule.side_effect = lambda **kwargs: schedules_list.append(kwargs) or kwargs
        
        # 使用 patch 模擬時間天數級前進，使得壓差回歸分析斜率非 0！
        from unittest.mock import patch
        start_time = time.time()
        with patch("services.immersion_service.time.time") as mock_time:
            for i in range(6):
                mock_time.return_value = start_time + i * 86400 # 每次前進 1 天
                self.service.process_immersion_telemetry(self.tank_id, self.base_data, [], mock_maintenance)
            
        # 壓差增加應觸發維護自癒
        self.assertTrue(self.base_data["trigger_filter_maintenance"])
        self.assertEqual(self.base_data["filter_status"], "critical")
        
        # 驗證 Mock 是否被正確調用來建立維護工單
        mock_maintenance.create_schedule.assert_called_once()
        args, kwargs = mock_maintenance.create_schedule.call_args
        self.assertEqual(kwargs["target"], self.tank_id)
        self.assertEqual(kwargs["task_type"], "Filter Replacement")
        self.assertIn("已自動排程", kwargs["notes"])

    def test_reset_consumables(self) -> None:
        """測試維護工單結案後，耗材重置與自癒邏輯應能將壓差與化學參數恢復為正常出廠狀態"""
        self.base_data["filter_dp_psi"] = 15.0
        self.base_data["conductivity_us_cm"] = 2.0
        self.base_data["ph_value"] = 4.5
        self.base_data["fluid_level_mm"] = 400.0
        
        mock_telemetry = MagicMock()
        mock_telemetry.latest_metrics = {self.tank_id: self.base_data}
        
        self.service.set_simulator_override(self.tank_id, {"clogged_filter": True, "water_intrusion": True})
        
        self.service.reset_consumables(self.tank_id, "Filter Replacement", mock_telemetry)
        
        overrides = self.service.get_simulator_override(self.tank_id)
        self.assertFalse(overrides.get("clogged_filter"))
        
        self.assertEqual(self.base_data["filter_dp_psi"], 2.2)
        self.assertEqual(self.base_data["filter_status"], "normal")
        self.assertFalse(self.base_data["trigger_filter_maintenance"])
        
        self.service.reset_consumables(self.tank_id, "Fluid Maintenance", mock_telemetry)
        
        self.assertEqual(self.base_data["fluid_level_mm"], 480.0)
        self.assertEqual(self.base_data["conductivity_us_cm"], 0.08)
        self.assertEqual(self.base_data["ph_value"], 7.2)
        self.assertEqual(self.base_data["chem_severity"], "normal")


if __name__ == "__main__":
    unittest.main()
