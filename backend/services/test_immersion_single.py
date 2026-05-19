# -*- coding: utf-8 -*-
"""
Unit tests for Single-Phase Immersion Cooling Service logic.
Strictly PEP 8 compliant, robust type hints, and complete coverage.
"""

from __future__ import annotations
import unittest
import time
from unittest.mock import MagicMock, patch
from typing import Dict, Any, List

from services.immersion_service import ImmersionCoolingService, SinglePhaseEngine


class TestSinglePhaseImmersionService(unittest.TestCase):
    def setUp(self) -> None:
        self.service = ImmersionCoolingService()
        self.node_id = "IMM-1P-001"
        self.base_data: Dict[str, Any] = {
            "type": "immersion_single",
            "filter_dp_psi": 2.2,
            "dielectric_strength_kv": 50.0,
            "tan_mg_koh_g": 0.02,
            "water_content_ppm": 15.0
        }
        self.latest_metrics: List[Dict[str, Any]] = [
            {"server_id": "IMM-1P-001-S1", "power_kw": 40.0, "temperature": 45.0},
            {"server_id": "IMM-1P-001-S2", "power_kw": 33.0, "temperature": 47.0}
        ]

    def test_single_phase_engine_directly(self) -> None:
        """
        直接測試 SinglePhaseEngine 實例方法，驗證流阻、溫升與油品狀態。
        """
        engine = SinglePhaseEngine(self.node_id)
        data = self.base_data.copy()
        override = {
            "gpu_load_kw": 73.0,
            "condenser_flow_lpm": 15.0,
            "condenser_inlet_temp": 35.0
        }
        
        engine.update_telemetry(data, self.latest_metrics, override)
        
        self.assertEqual(data["type"], "immersion_single")
        # delta_t 預期會受限於 60.0
        self.assertEqual(data["delta_t"], 60.0)
        self.assertEqual(data["outlet_temp"], 95.0) # 35 + 60
        self.assertTrue(data["hotspot_prob"] > 90.0)
        self.assertTrue(data["should_throttle"])

    def test_single_phase_convection_and_temp_rise(self) -> None:
        """
        驗證單相對流溫升計算以及出水溫度推導（透過 Service 入口）。
        功率 73 kW, 泵油流量 15 LPM.
        """
        # 設定模擬覆寫值
        self.service.set_simulator_override(self.node_id, {
            "gpu_load_kw": 73.0,
            "condenser_flow_lpm": 15.0,
            "condenser_inlet_temp": 35.0
        })
        
        data = self.base_data.copy()
        self.service.process_immersion_telemetry(self.node_id, data, self.latest_metrics)
        
        self.assertEqual(data["type"], "immersion_single")
        self.assertEqual(data["delta_t"], 60.0)
        self.assertEqual(data["outlet_temp"], 95.0) # 35 + 60
        self.assertTrue(data["hotspot_prob"] > 90.0)
        self.assertTrue(data["should_throttle"])
        
    def test_single_phase_dielectric_drop_on_water_intrusion(self) -> None:
        """
        驗證當模擬外部水氣入侵時，介電強度跌落與短路警報自癒啟動。
        """
        self.service.set_simulator_override(self.node_id, {
            "water_intrusion": True,
            "condenser_flow_lpm": 50.0  # 提供足夠流速防止過熱
        })
        
        data = self.base_data.copy()
        self.service.process_immersion_telemetry(self.node_id, data, self.latest_metrics)
        
        # 介電強度降低 3.75 kV，水分增加 15 ppm
        self.assertEqual(data["water_content_ppm"], 30.0)
        self.assertEqual(data["dielectric_strength_kv"], 46.2) # 50 - 3.75 = 46.25
        
        # 連續模擬 8 次，使介電強度跌破 30 kV
        for _ in range(8):
            self.service.process_immersion_telemetry(self.node_id, data, self.latest_metrics)
            
        self.assertTrue(data["dielectric_strength_kv"] < 30.0)
        self.assertEqual(data["regeneration_state"], "active_full")
        self.assertEqual(data["chem_severity"], "critical")

    def test_single_phase_acid_buildup_and_active_regeneration(self) -> None:
        """
        驗證高溫氧化下總酸值 (TAN) 的累積與活性白土自癒吸附。
        """
        self.service.set_simulator_override(self.node_id, {
            "gpu_load_kw": 80.0,
            "condenser_flow_lpm": 15.0
        })
        
        data = self.base_data.copy()
        data["tan_mg_koh_g"] = 0.14
        
        # 由於功率高且超溫，TAN 酸化 +0.01 -> 0.15。且因為大於等於 0.15 同步觸發 active_full 淨化 (-0.008)
        self.service.process_immersion_telemetry(self.node_id, data, self.latest_metrics)
        self.assertEqual(data["tan_mg_koh_g"], 0.142)
        self.assertEqual(data["regeneration_state"], "active_full")

    def test_single_phase_closed_loop_self_healing_maintenance_ticket(self) -> None:
        """
        驗證過濾器壓差時序回歸，在預測天數過低時是否能成功向維護系統自動派發單相過濾器更換工單。
        """
        mock_maintenance = MagicMock()
        mock_maintenance.list_schedules.return_value = []
        
        self.service.set_simulator_override(self.node_id, {
            "clogged_filter": True,
            "condenser_flow_lpm": 80.0
        })
        
        data = self.base_data.copy()
        start_time = time.time()
        
        # 時序推進並累積遙測數據，使壓差回歸斜率預測出需要維護
        with patch("services.immersion_service.time.time") as mock_time:
            for i in range(10):
                mock_time.return_value = start_time + i * 86400  # 推進天數
                self.service.process_immersion_telemetry(self.node_id, data, self.latest_metrics, mock_maintenance)
                
        # 驗證是否自動註冊了 Filter Replacement (Single-Phase) 任務
        mock_maintenance.create_schedule.assert_called()
        args, kwargs = mock_maintenance.create_schedule.call_args
        self.assertEqual(kwargs["target"], self.node_id)
        self.assertEqual(kwargs["task_type"], "Filter Replacement (Single-Phase)")
        self.assertTrue("單相冷卻油" in kwargs["notes"])

    def test_single_phase_reset_consumables(self) -> None:
        """驗證維護工單結案後，單相浸沒式冷卻系統的壓差與油品指標能自癒重置為新出廠狀態"""
        self.base_data["filter_dp_psi"] = 15.0
        self.base_data["dielectric_strength_kv"] = 18.0
        self.base_data["tan_mg_koh_g"] = 0.35
        self.base_data["water_content_ppm"] = 80.0
        
        mock_telemetry = MagicMock()
        mock_telemetry.latest_metrics = {self.node_id: self.base_data}
        
        self.service.set_simulator_override(self.node_id, {"clogged_filter": True, "water_intrusion": True})
        
        self.service.reset_consumables(self.node_id, "Filter Replacement (Single-Phase)", mock_telemetry)
        overrides = self.service.get_simulator_override(self.node_id)
        self.assertFalse(overrides.get("clogged_filter"))
        self.assertEqual(self.base_data["filter_dp_psi"], 2.2)
        
        self.service.reset_consumables(self.node_id, "Fluid Maintenance", mock_telemetry)
        overrides = self.service.get_simulator_override(self.node_id)
        self.assertFalse(overrides.get("water_intrusion"))
        self.assertEqual(self.base_data["dielectric_strength_kv"], 50.0)
        self.assertEqual(self.base_data["tan_mg_koh_g"], 0.02)
        self.assertEqual(self.base_data["water_content_ppm"], 15.0)


if __name__ == "__main__":
    unittest.main()
