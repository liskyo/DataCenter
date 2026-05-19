"""Workload simulation service for Job-Aware Power Management demo.

Generates realistic AI training/inference job lifecycle events with
thermal load predictions. Designed for COMPUTEX exhibition without
requiring real K8s/Slurm integration.
"""

from __future__ import annotations

import math
import random
import threading
import time
import uuid
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any, Callable, Dict, List, Optional


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class GpuProfile:
    """GPU thermal/compute specification."""
    model_name: str
    gpu_count: int
    pflops: float
    tdp_per_gpu_w: float  # Thermal Design Power per GPU (Watts)
    typical_mfu: float    # Machine FLOPs Utilization (0.0~1.0)

    @property
    def estimated_heat_kw(self) -> float:
        """Estimated steady-state heat output in kW."""
        return (self.gpu_count * self.tdp_per_gpu_w * self.typical_mfu) / 1000.0


# Pre-defined workload templates for demo
WORKLOAD_TEMPLATES: list[dict[str, Any]] = [
    {"name": "GPT-4 Fine-tuning", "gpu_model": "8x NVIDIA HGX H100", "gpu_count": 32, "pflops": 32.0, "tdp": 700, "mfu": 0.85, "duration_s": 180, "category": "training"},
    {"name": "Llama-3-70B Pre-training", "gpu_model": "8x NVIDIA HGX H100", "gpu_count": 64, "pflops": 64.0, "tdp": 700, "mfu": 0.45, "duration_s": 300, "category": "training"},
    {"name": "Stable Diffusion XL Batch", "gpu_model": "8x NVIDIA HGX A100", "gpu_count": 8, "pflops": 5.0, "tdp": 400, "mfu": 0.70, "duration_s": 120, "category": "training"},
    {"name": "ResNet-152 Inference", "gpu_model": "4x NVIDIA L40S", "gpu_count": 4, "pflops": 3.0, "tdp": 350, "mfu": 0.30, "duration_s": -1, "category": "inference"},
    {"name": "Gemma-2 27B SFT", "gpu_model": "8x NVIDIA HGX H200", "gpu_count": 16, "pflops": 32.0, "tdp": 700, "mfu": 0.50, "duration_s": 240, "category": "training"},
    {"name": "Whisper-v3 Transcription", "gpu_model": "4x NVIDIA L40S", "gpu_count": 4, "pflops": 3.0, "tdp": 350, "mfu": 0.55, "duration_s": 90, "category": "inference"},
    {"name": "DeepSeek-V3 LoRA", "gpu_model": "8x NVIDIA GB200 (Blackwell)", "gpu_count": 16, "pflops": 160.0, "tdp": 1000, "mfu": 0.40, "duration_s": 200, "category": "training"},
    {"name": "Mixtral 8x22B Serving", "gpu_model": "8x AMD Instinct MI300X", "gpu_count": 8, "pflops": 42.0, "tdp": 750, "mfu": 0.35, "duration_s": -1, "category": "inference"},
]


@dataclass
class WorkloadJob:
    """A simulated AI workload job."""
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8].upper())
    name: str = ""
    category: str = "training"
    gpu_model: str = ""
    gpu_count: int = 0
    pflops: float = 0.0
    tdp_per_gpu_w: float = 0.0
    mfu: float = 0.0
    estimated_heat_kw: float = 0.0
    status: JobStatus = JobStatus.PENDING
    progress: float = 0.0          # 0.0 ~ 1.0
    duration_s: float = 120.0      # -1 means infinite (service)
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    assigned_nodes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["status"] = self.status.value
        return d


@dataclass
class TimelinePoint:
    """A single point in the workload timeline."""
    timestamp: float
    time_label: str
    total_pflops: float
    active_gpu_count: int
    active_heat_kw: float
    gpu_temp_actual: float
    cdu_flow_lpm: float
    cdu_supply_temp: float
    cdu_return_temp: float
    proactive_cdu_flow: float   # Feed-forward CDU flow
    reactive_cdu_flow: float    # Traditional PID CDU flow
    proactive_gpu_temp: float   # Temp under proactive control
    reactive_gpu_temp: float    # Temp under reactive control
    job_events: list[dict[str, str]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class WorkloadSimulator:
    """Simulates AI workload scheduling with thermal predictions."""

    MAX_TIMELINE_POINTS = 120  # ~2 min at 1-second granularity
    MAX_COMPLETED_JOBS = 20

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._jobs: Dict[str, WorkloadJob] = {}
        self._timeline: List[TimelinePoint] = []
        self._stop_event = threading.Event()

        # Thermal simulation state
        self._proactive_gpu_temp: float = 25.0
        self._reactive_gpu_temp: float = 25.0
        self._proactive_cdu_flow: float = 5.0   # LPM baseline
        self._reactive_cdu_flow: float = 5.0
        self._ambient_temp: float = 22.0
        self._tick_count: int = 0

        # Auto-dispatch config
        self._auto_dispatch: bool = True
        self._next_dispatch_at: float = time.time() + random.uniform(5, 15)

    # ---- Public API ----

    def get_jobs(self) -> list[dict[str, Any]]:
        with self._lock:
            jobs = sorted(
                self._jobs.values(),
                key=lambda j: (
                    0 if j.status == JobStatus.RUNNING else
                    1 if j.status == JobStatus.PENDING else
                    2,
                    -j.created_at,
                ),
            )
            return [j.to_dict() for j in jobs]

    def get_timeline(self) -> list[dict[str, Any]]:
        with self._lock:
            return [p.to_dict() for p in self._timeline]

    def dispatch_job(self, template_index: Optional[int] = None) -> dict[str, Any]:
        """Manually dispatch a job (for demo button)."""
        with self._lock:
            return self._create_job(template_index).to_dict()

    # ---- Simulation Engine ----

    def simulation_tick(self) -> None:
        """Called every ~2s by the background worker."""
        now = time.time()

        with self._lock:
            self._tick_count += 1

            # Auto-dispatch new jobs periodically
            if self._auto_dispatch and now >= self._next_dispatch_at:
                running = sum(1 for j in self._jobs.values() if j.status == JobStatus.RUNNING)
                pending = sum(1 for j in self._jobs.values() if j.status == JobStatus.PENDING)
                if running < 4 and pending < 2:
                    self._create_job()
                self._next_dispatch_at = now + random.uniform(15, 40)

            events: list[dict[str, str]] = []

            # Transition PENDING → RUNNING
            for job in list(self._jobs.values()):
                if job.status == JobStatus.PENDING:
                    running = sum(1 for j in self._jobs.values() if j.status == JobStatus.RUNNING)
                    if running < 4 and (now - job.created_at) > random.uniform(3, 8):
                        job.status = JobStatus.RUNNING
                        job.started_at = now
                        job.assigned_nodes = self._assign_nodes(job.gpu_count)
                        events.append({"type": "start", "job_id": job.id, "name": job.name})

            # Update RUNNING jobs
            for job in list(self._jobs.values()):
                if job.status != JobStatus.RUNNING or job.started_at is None:
                    continue

                elapsed = now - job.started_at
                if job.duration_s > 0:
                    job.progress = min(1.0, elapsed / job.duration_s)
                    if job.progress >= 1.0:
                        job.status = JobStatus.COMPLETED
                        job.completed_at = now
                        events.append({"type": "complete", "job_id": job.id, "name": job.name})
                else:
                    # Infinite service job — slowly oscillate progress
                    job.progress = 0.5 + 0.3 * math.sin(elapsed * 0.05)

            # Prune completed jobs
            completed = [j for j in self._jobs.values() if j.status in (JobStatus.COMPLETED, JobStatus.FAILED)]
            if len(completed) > self.MAX_COMPLETED_JOBS:
                completed.sort(key=lambda j: j.completed_at or 0)
                for old in completed[: len(completed) - self.MAX_COMPLETED_JOBS]:
                    del self._jobs[old.id]

            # Compute aggregate metrics
            running_jobs = [j for j in self._jobs.values() if j.status == JobStatus.RUNNING]
            total_pflops = sum(j.pflops for j in running_jobs)
            total_gpus = sum(j.gpu_count for j in running_jobs)
            total_heat_kw = sum(j.estimated_heat_kw for j in running_jobs)

            # Thermal simulation: proactive vs reactive
            self._simulate_thermal(total_heat_kw, events)

            # Build timeline point
            ts = time.localtime(now)
            time_label = f"{ts.tm_hour:02d}:{ts.tm_min:02d}:{ts.tm_sec:02d}"
            point = TimelinePoint(
                timestamp=now,
                time_label=time_label,
                total_pflops=round(total_pflops, 1),
                active_gpu_count=total_gpus,
                active_heat_kw=round(total_heat_kw, 2),
                gpu_temp_actual=round(self._proactive_gpu_temp, 1),
                cdu_flow_lpm=round(self._proactive_cdu_flow, 1),
                cdu_supply_temp=round(self._ambient_temp + random.uniform(-0.5, 0.5), 1),
                cdu_return_temp=round(self._ambient_temp + total_heat_kw * 0.8 + random.uniform(-0.3, 0.3), 1),
                proactive_cdu_flow=round(self._proactive_cdu_flow, 1),
                reactive_cdu_flow=round(self._reactive_cdu_flow, 1),
                proactive_gpu_temp=round(self._proactive_gpu_temp, 1),
                reactive_gpu_temp=round(self._reactive_gpu_temp, 1),
                job_events=events,
            )
            self._timeline.append(point)
            if len(self._timeline) > self.MAX_TIMELINE_POINTS:
                self._timeline = self._timeline[-self.MAX_TIMELINE_POINTS:]

    def _simulate_thermal(self, total_heat_kw: float, events: list[dict[str, str]]) -> None:
        """Simulate proactive (feed-forward) vs reactive (PID) CDU control."""
        dt = 2.0  # simulation timestep (seconds)

        # Target CDU flow based on heat load:  base_flow + heat_proportional
        target_flow = 5.0 + total_heat_kw * 1.2
        target_flow = max(5.0, min(target_flow, 25.0))

        # --- Proactive (Feed-forward) Control ---
        # Responds immediately to job dispatch events and heat predictions
        has_start_event = any(e["type"] == "start" for e in events)
        if has_start_event:
            # Pre-ramp: jump CDU flow toward target immediately
            self._proactive_cdu_flow += (target_flow - self._proactive_cdu_flow) * 0.8
        else:
            # Smooth tracking with fast response (tau ~= 4s)
            self._proactive_cdu_flow += (target_flow - self._proactive_cdu_flow) * (dt / 4.0)

        # Proactive GPU temperature: heat generation vs cooling removal
        heat_input = total_heat_kw * 0.15  # Thermal mass scaling
        cooling_removal = (self._proactive_cdu_flow - 5.0) * 0.12
        self._proactive_gpu_temp += (heat_input - cooling_removal) * dt
        # Natural dissipation toward ambient
        self._proactive_gpu_temp += (self._ambient_temp - self._proactive_gpu_temp) * 0.02 * dt
        self._proactive_gpu_temp = max(self._ambient_temp, min(self._proactive_gpu_temp, 95.0))
        # Small noise
        self._proactive_gpu_temp += random.uniform(-0.3, 0.3)

        # --- Reactive (Traditional PID) Control ---
        # Only reacts after temperature rises, with significant lag
        temp_error = self._reactive_gpu_temp - 35.0  # setpoint = 35°C
        if temp_error > 0:
            # Slow response (tau ~= 20s) — typical of traditional feedback control
            self._reactive_cdu_flow += temp_error * 0.05 * dt
        else:
            # Slowly reduce when temp is below setpoint
            self._reactive_cdu_flow += (5.0 - self._reactive_cdu_flow) * 0.01 * dt
        self._reactive_cdu_flow = max(5.0, min(self._reactive_cdu_flow, 25.0))

        # Reactive GPU temperature: same heat input but slower cooling response
        reactive_cooling = (self._reactive_cdu_flow - 5.0) * 0.12
        self._reactive_gpu_temp += (heat_input - reactive_cooling) * dt
        self._reactive_gpu_temp += (self._ambient_temp - self._reactive_gpu_temp) * 0.02 * dt
        self._reactive_gpu_temp = max(self._ambient_temp, min(self._reactive_gpu_temp, 95.0))
        self._reactive_gpu_temp += random.uniform(-0.3, 0.3)

    def _create_job(self, template_index: Optional[int] = None) -> WorkloadJob:
        """Create a new job from a template."""
        if template_index is not None and 0 <= template_index < len(WORKLOAD_TEMPLATES):
            tmpl = WORKLOAD_TEMPLATES[template_index]
        else:
            tmpl = random.choice(WORKLOAD_TEMPLATES)

        job = WorkloadJob(
            name=tmpl["name"],
            category=tmpl["category"],
            gpu_model=tmpl["gpu_model"],
            gpu_count=tmpl["gpu_count"],
            pflops=tmpl["pflops"],
            tdp_per_gpu_w=tmpl["tdp"],
            mfu=tmpl["mfu"],
            estimated_heat_kw=round(
                (tmpl["gpu_count"] * tmpl["tdp"] * tmpl["mfu"]) / 1000.0, 2
            ),
            duration_s=tmpl["duration_s"] if tmpl["duration_s"] > 0 else -1,
        )
        self._jobs[job.id] = job
        return job

    def _assign_nodes(self, gpu_count: int) -> list[str]:
        """Simulate node assignment."""
        node_count = max(1, gpu_count // 8)
        base_idx = random.randint(1, 14)
        return [f"SERVER-{str(base_idx + i).zfill(3)}" for i in range(node_count)]

    # ---- Background Worker ----

    def worker(self, stop_event: threading.Event) -> None:
        """Background thread entry point."""
        self._stop_event = stop_event
        while not stop_event.is_set():
            try:
                self.simulation_tick()
            except Exception as exc:
                print(f"[WorkloadSimulator] Error: {exc}")
            if stop_event.wait(2):
                break
