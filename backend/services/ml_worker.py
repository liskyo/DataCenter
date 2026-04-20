from __future__ import annotations

import collections
import logging

try:
    from sklearn.ensemble import IsolationForest
    import numpy as np
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False


class AnomalyDetectionEngine:
    def __init__(self, window_size: int = 60, contamination: float = 0.05):
        self.window_size = window_size
        self.contamination = contamination
        # Stores recent history of (temp, cpu). 
        self.history: dict[str, collections.deque[tuple[float, float]]] = {}
        # We only fit periodically per server to save CPU
        self.counter: dict[str, int] = {}
        self.models: dict[str, 'IsolationForest'] = {}

    def detect(self, server_id: str, temp: float, cpu: float) -> tuple[bool, str]:
        if not ML_AVAILABLE:
            return False, "ML Engine not available (missing scikit-learn)"

        if server_id not in self.history:
            self.history[server_id] = collections.deque(maxlen=self.window_size)
            self.counter[server_id] = 0

        hist_ref = self.history[server_id]
        hist_ref.append((temp, cpu))
        self.counter[server_id] += 1

        # We need enough data to train 
        n_samples = len(hist_ref)
        if n_samples < 20:
            return False, ""

        # Retrain isolation forest every 10 new data points
        if self.counter[server_id] >= 10 or server_id not in self.models:
            self.counter[server_id] = 0
            
            # Fit model
            X = np.array(hist_ref)
            model = IsolationForest(
                n_estimators=50, 
                contamination=self.contamination, 
                random_state=42
            )
            try:
                model.fit(X)
                self.models[server_id] = model
            except Exception as e:
                return False, f"ML fitting error: {e}"

        # Prediction
        model = self.models.get(server_id)
        if not model:
            return False, ""

        current_pt = np.array([[temp, cpu]])
        pred = model.predict(current_pt)
        
        # pred == -1 means anomaly
        if pred[0] == -1:
            # Verify if it's potentially overheat/overload instead of zeroes
            if temp > 35 or cpu > 50:
                return True, f"AI 預知異常 (Isolation Forest): 捕捉到非典型過載行為 (Temp:{temp:.1f}°C, CPU:{cpu:.1f}%)"
            
        return False, ""
