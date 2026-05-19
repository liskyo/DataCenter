"use client";
import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { useDcimStore, ServerData } from "@/store/useDcimStore";
import { apiUrl } from "@/shared/api";
import { authFetch } from "@/shared/auth";
import { buildTelemetryKeys, normalizeNodeId, resolveTelemetryRecordDeep } from "@/shared/nodeId";
import dynamic from "next/dynamic";
import { Activity, Download, Upload, Server, Trash, Save, Edit, Lock, Thermometer, Zap, Box, MonitorIcon, Globe, Link2, Droplets, Cpu, Leaf } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Legend, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
const TwinsSceneCanvas = dynamic(
    () => import("@/features/twins/TwinsSceneCanvas").then((mod) => mod.TwinsSceneCanvas),
    {
        ssr: false,
        loading: () => (
            <div className="absolute inset-0 z-0 flex items-center justify-center bg-[#010613]/50 backdrop-blur-sm text-cyan-500">
                <div className="flex flex-col items-center gap-4 border border-cyan-800/50 bg-[#020b1a]/80 p-8 rounded-xl shadow-[0_0_30px_rgba(6,182,212,0.15)]">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-900 border-t-cyan-400"></div>
                    <span className="font-mono text-sm tracking-widest text-cyan-200 animate-pulse">INITIALIZING 3D ENGINE...</span>
                </div>
            </div>
        )
    }
);
import { v4 as uuidv4 } from "uuid";
import { useLanguage } from "@/shared/i18n/language";
import { usePolling } from "@/shared/hooks/usePolling";
import {
    DEFAULT_DEVICE_COMM_CONFIGS,
    DeviceType as CommDeviceType,
    resolveCommMethodByModel,
} from "@/shared/networkComm";

const GPU_PFLOPS_MAP: Record<string, number> = {
    "8x NVIDIA GB200 (Blackwell)": 36.0,
    "8x NVIDIA HGX H200": 32.0,
    "8x NVIDIA HGX H100": 32.0,
    "8x NVIDIA HGX A100": 5.0,
    "4x NVIDIA L40S": 1.5,
    "8x AMD Instinct MI300X": 10.4,
    "8x Intel Gaudi 3": 8.0
};

const TwoPhaseTankView = ({ voidFraction = 12.5, levelPercent = 95.0, isCondensating = true }: {
    voidFraction?: number;
    levelPercent?: number;
    isCondensating?: boolean;
}) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let bubbles: Array<{ x: number; y: number; size: number; speed: number; phase: number }> = [];
        let rainDrops: Array<{ x: number; y: number; speed: number; length: number }> = [];

        for (let i = 0; i < 40; i++) {
            bubbles.push({
                x: 20 + Math.random() * 160,
                y: 50 + Math.random() * 120,
                size: 1 + Math.random() * 2.5,
                speed: 0.4 + Math.random() * 1.2,
                phase: Math.random() * Math.PI * 2
            });
        }

        for (let i = 0; i < 5; i++) {
            rainDrops.push({
                x: 15 + Math.random() * 170,
                y: 25 + Math.random() * 30,
                speed: 1.2 + Math.random() * 1.8,
                length: 3 + Math.random() * 3
            });
        }

        const render = () => {
            const width = canvas.width;
            const height = canvas.height;
            ctx.clearRect(0, 0, width, height);

            ctx.strokeStyle = "#083344";
            ctx.lineWidth = 3;
            ctx.strokeRect(5, 5, width - 10, height - 10);

            const liquidHeight = (height - 30) * (levelPercent / 100.0);
            const liquidY = height - 10 - liquidHeight;

            ctx.fillStyle = "rgba(6, 182, 212, 0.15)";
            ctx.beginPath();
            ctx.moveTo(7, height - 7);
            ctx.lineTo(7, liquidY);
            const time = Date.now() * 0.003;
            for (let x = 7; x <= width - 7; x += 5) {
                const y = liquidY + Math.sin(x * 0.05 + time) * 1.5;
                ctx.lineTo(x, y);
            }
            ctx.lineTo(width - 7, height - 7);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = "#334155";
            ctx.fillRect(15, 12, width - 30, 6);

            if (isCondensating) {
                ctx.fillStyle = "rgba(6, 182, 212, 0.65)";
                rainDrops.forEach((drop) => {
                    ctx.fillRect(drop.x, drop.y, 1, drop.length);
                    drop.y += drop.speed;
                    if (drop.y > liquidY) {
                        drop.y = 20;
                        drop.x = 15 + Math.random() * (width - 30);
                    }
                });
            }

            const chipWidth = 70;
            const chipHeight = 16;
            const chipX = width / 2 - chipWidth / 2;
            const chipY = height - 25;

            ctx.fillStyle = voidFraction > 60 ? "#ef4444" : voidFraction > 35 ? "#f59e0b" : "#0e7490";
            ctx.fillRect(chipX, chipY, chipWidth, chipHeight);
            
            ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
            ctx.fillRect(chipX + 15, chipY + 3, chipWidth - 30, chipHeight - 6);

            ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
            ctx.lineWidth = 0.8;
            
            const activeBubblesCount = Math.min(bubbles.length, Math.floor(voidFraction * 0.7) + 5);
            for (let i = 0; i < activeBubblesCount; i++) {
                const bubble = bubbles[i];
                ctx.beginPath();
                ctx.arc(bubble.x, bubble.y, bubble.size, 0, Math.PI * 2);
                ctx.stroke();

                bubble.y -= bubble.speed;
                bubble.x += Math.sin(bubble.y * 0.05 + bubble.phase) * 0.25;

                if (bubble.y < liquidY || bubble.y < 15) {
                    bubble.y = chipY - Math.random() * 4;
                    bubble.x = chipX + Math.random() * chipWidth;
                }
            }

            if (voidFraction > 60) {
                ctx.fillStyle = "rgba(239, 68, 68, 0.35)";
                ctx.fillRect(chipX - 3, chipY - 3, chipWidth + 6, chipHeight + 3);
                ctx.strokeStyle = "#ef4444";
                ctx.lineWidth = 1;
                ctx.strokeRect(chipX - 3, chipY - 3, chipWidth + 6, chipHeight + 3);
                
                ctx.fillStyle = "#ef4444";
                ctx.font = "bold 8px monospace";
                ctx.fillText("DRY-OUT RISK", chipX + 5, chipY - 5);
            }

            animationFrameRef.current = requestAnimationFrame(render);
        };

        render();

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [voidFraction, levelPercent, isCondensating]);

    return (
        <div className="relative flex flex-col items-center bg-[#020712] border border-cyan-500/20 rounded-xl p-2.5 shadow-[inset_0_0_15px_rgba(6,182,212,0.1)]">
            <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-widest absolute top-1.5 left-2.5">
                🧪 2D 槽體剖面模擬視圖
            </span>
            <canvas ref={canvasRef} width={200} height={140} className="w-full max-w-[210px] h-[140px] rounded-lg mt-3" />
        </div>
    );
};

const SinglePhaseTankView = ({ pumpFlow = 15.0, maxGpuTemp = 45.0, deltaT = 15.0 }: {
    pumpFlow?: number;
    maxGpuTemp?: number;
    deltaT?: number;
}) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // 流場小光點粒子
        let particles: Array<{ x: number; y: number; speed: number; phase: number }> = [];
        for (let i = 0; i < 22; i++) {
            particles.push({
                x: 10 + Math.random() * 180,
                y: 20 + Math.random() * 100,
                speed: 0.6 + Math.random() * 1.6,
                phase: Math.random() * Math.PI * 2
            });
        }

        const render = () => {
            const width = canvas.width;
            const height = canvas.height;
            ctx.clearRect(0, 0, width, height);

            // 1. 繪製邊框
            ctx.strokeStyle = "#0ea5e9";
            ctx.lineWidth = 1.5;
            ctx.strokeRect(5, 5, width - 10, height - 10);

            // 2. 繪製平滑熱對流對流梯度背景
            const grad = ctx.createLinearGradient(0, height - 10, 0, 10);
            
            const isHot = maxGpuTemp > 78.0;
            const topColor = isHot ? "rgba(239, 68, 68, 0.45)" : maxGpuTemp > 65.0 ? "rgba(245, 158, 11, 0.3)" : "rgba(14, 116, 144, 0.3)";
            const bottomColor = "rgba(30, 58, 138, 0.35)"; // 深藍 (冷油進)
            
            // 根據泵浦流量動態擴大底部藍色冷油區間，最高可至 0.85 比例的高度
            const coldStop = Math.min(0.85, Math.max(0.15, 0.15 + (pumpFlow / 150.0) * 0.65));
            
            grad.addColorStop(0, bottomColor);
            grad.addColorStop(coldStop, "rgba(8, 145, 178, 0.2)");
            grad.addColorStop(1, topColor);
            
            ctx.fillStyle = grad;
            ctx.fillRect(6, 6, width - 12, height - 12);

            // 3. 繪製頂部氣室邊界 (無冷凝盤管，僅為基本的蓋板)
            ctx.fillStyle = "rgba(15, 23, 42, 0.65)";
            ctx.fillRect(6, 6, width - 12, 12);

            // 4. 繪製伺服器晶片節點
            const chipWidth = 80;
            const chipHeight = 18;
            const chipX = width / 2 - chipWidth / 2;
            const chipY = height - 45;

            ctx.fillStyle = maxGpuTemp > 78.0 ? "#ef4444" : maxGpuTemp > 65.0 ? "#f59e0b" : "#0284c7";
            ctx.fillRect(chipX, chipY, chipWidth, chipHeight);
            
            ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
            ctx.fillRect(chipX + 15, chipY + 4, chipWidth - 30, chipHeight - 8);

            // 5. 繪製對流流動粒子 (Flow Vector Arrows)
            ctx.fillStyle = maxGpuTemp > 78.0 ? "rgba(248, 113, 113, 0.8)" : "rgba(56, 189, 248, 0.8)";
            
            // 流動速度與泵浦流量成正比
            const speedFactor = (pumpFlow / 15.0) * 0.85;
            
            particles.forEach((p) => {
                // 繪製向上流動的向量流速小箭頭 (Flow Vector Arrow)
                ctx.beginPath();
                ctx.moveTo(p.x, p.y - 3.5); // 箭頭頂點
                ctx.lineTo(p.x - 2.5, p.y + 1.5); // 左側翼
                ctx.lineTo(p.x - 1, p.y + 0.5); // 左內折
                ctx.lineTo(p.x - 1, p.y + 3.5); // 箭身左底
                ctx.lineTo(p.x + 1, p.y + 3.5); // 箭身右底
                ctx.lineTo(p.x + 1, p.y + 0.5); // 右內折
                ctx.lineTo(p.x + 2.5, p.y + 1.5); // 右側翼
                ctx.closePath();
                ctx.fill();

                // 強制循環流向：從底部向上湧流，遇到頂部向四周擴散後回落循環
                p.y -= p.speed * speedFactor;
                p.x += Math.sin(p.y * 0.05 + p.phase) * 0.35 * speedFactor;

                if (p.y < 18) {
                    p.y = height - 15 - Math.random() * 15;
                    p.x = 10 + Math.random() * (width - 20);
                }
            });

            // 6. 出水口與入水口箭頭示意
            ctx.fillStyle = "#0284c7";
            ctx.fillRect(12, height - 15, 10, 5); // 底部入水口
            ctx.fillStyle = maxGpuTemp > 78.0 ? "#ef4444" : "#eab308";
            ctx.fillRect(width - 22, 20, 10, 5);  // 頂部出水口

            if (maxGpuTemp > 78.0) {
                ctx.fillStyle = "rgba(239, 68, 68, 0.3)";
                ctx.fillRect(chipX - 4, chipY - 4, chipWidth + 8, chipHeight + 4);
                ctx.strokeStyle = "#ef4444";
                ctx.lineWidth = 1;
                ctx.strokeRect(chipX - 4, chipY - 4, chipWidth + 8, chipHeight + 4);
                
                ctx.fillStyle = "#ef4444";
                ctx.font = "bold 8px monospace";
                ctx.fillText("OVERHEAT RISK", chipX + 5, chipY - 5);
            }

            animationFrameRef.current = requestAnimationFrame(render);
        };

        render();

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [pumpFlow, maxGpuTemp, deltaT]);

    return (
        <div className="relative flex flex-col items-center bg-[#020712] border border-cyan-500/20 rounded-xl p-2.5 shadow-[inset_0_0_15px_rgba(6,182,212,0.1)]">
            <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-widest absolute top-1.5 left-2.5">
                🧪 2D 槽體流場熱梯度模擬
            </span>
            <canvas ref={canvasRef} width={200} height={140} className="w-full max-w-[210px] h-[140px] rounded-lg mt-3" />
        </div>
    );
};


export default function TwinsPage() {
    useEffect(() => {
        // three.js r183 emits this deprecation warning from internals; silence only this one in dev.
        if (process.env.NODE_ENV !== "development") return;
        const originalWarn = console.warn;
        console.warn = (...args: unknown[]) => {
            const first = args[0];
            if (
                typeof first === "string" &&
                first.includes("THREE.THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.")
            ) {
                return;
            }
            originalWarn(...args);
        };
        return () => {
            console.warn = originalWarn;
        };
    }, []);

    const { language } = useLanguage();
    const t = language === "en"
        ? {
            title: "3D Dynamic Data Center",
            unknownSite: "Unknown Site",
            realtime: "REAL-TIME DYNAMIC INFRASTRUCTURE",
            regionView: "REGION VIEW",
            floorView: "FLOOR VIEW",
            editMode: "EDIT MODE",
            viewOnly: "VIEW ONLY",
            rackSettings: "Rack Settings",
            equipmentSettings: "Equipment Settings",
            installedEquipment: "Installed Equipment",
            emptyRack: "EMPTY RACK",
            connectionLinesShow: "Show network & CDU links",
            connectionLinesHide: "Hide network & CDU links",
        }
        : {
            title: "3D 動態機房",
            unknownSite: "未知地點",
            realtime: "即時動態基礎設施",
            regionView: "區域視圖",
            floorView: "樓層視圖",
            editMode: "編輯模式",
            viewOnly: "僅檢視",
            rackSettings: "機櫃設定",
            equipmentSettings: "設備設定",
            installedEquipment: "已安裝設備",
            emptyRack: "空機櫃",
            connectionLinesShow: "顯示連接線",
            connectionLinesHide: "隱藏連接線",
        };
    const {
        racks,
        equipments,
        locations,
        currentLocationId,
        selectedRackId,
        selectedEquipmentId,
        isEditMode,
        setEditMode,
        addRack,
        addEquipment,
        selectRack,
        selectEquipment,
        exportState,
        importState,
        addServerToRack,
        removeRack,
        updateRackName,
        updateRackModel,
        updateRackIp,
        updateRack,
        updateRackRotation,
        updateRackConnection,
        removeServerFromRack,
        updateServerInRack,
        updateLocationName,
        updateLocationProps,
        removeLocation,
        removeEquipment,
        updateEquipmentName,
        updateEquipmentModel,
        updateEquipmentRotation,
        updateEquipmentIp,
        updateEquipmentConnectedRacks,
        assignRackToCdu,
        commConfigs,
    } = useDcimStore(
        useShallow((s) => ({
            racks: s.racks,
            equipments: s.equipments,
            locations: s.locations,
            currentLocationId: s.currentLocationId,
            selectedRackId: s.selectedRackId,
            selectedEquipmentId: s.selectedEquipmentId,
            isEditMode: s.isEditMode,
            setEditMode: s.setEditMode,
            addRack: s.addRack,
            addEquipment: s.addEquipment,
            selectRack: s.selectRack,
            selectEquipment: s.selectEquipment,
            exportState: s.exportState,
            importState: s.importState,
            addServerToRack: s.addServerToRack,
            removeRack: s.removeRack,
            updateRackName: s.updateRackName,
            updateRackModel: s.updateRackModel,
            updateRackIp: s.updateRackIp,
            updateRack: s.updateRack,
            updateRackRotation: s.updateRackRotation,
            updateRackConnection: s.updateRackConnection,
            removeServerFromRack: s.removeServerFromRack,
            updateServerInRack: s.updateServerInRack,
            updateLocationName: s.updateLocationName,
            updateLocationProps: s.updateLocationProps,
            removeLocation: s.removeLocation,
            removeEquipment: s.removeEquipment,
            updateEquipmentName: s.updateEquipmentName,
            updateEquipmentModel: s.updateEquipmentModel,
            updateEquipmentRotation: s.updateEquipmentRotation,
            updateEquipmentIp: s.updateEquipmentIp,
            updateEquipmentConnectedRacks: s.updateEquipmentConnectedRacks,
            assignRackToCdu: s.assignRackToCdu,
            commConfigs: s.deviceCommConfigs,
        })),
    );

    const locationRacks = useMemo(
        () => racks.filter((r) => r.locationId === currentLocationId),
        [racks, currentLocationId],
    );
    const locationEquipments = useMemo(
        () => equipments.filter((e) => e.locationId === currentLocationId),
        [equipments, currentLocationId],
    );

    const selectedRack = racks.find((r) => r.id === selectedRackId && r.locationId === currentLocationId);
    const selectedEquipment = equipments.find((e) => e.id === selectedEquipmentId && e.locationId === currentLocationId);

    const clearSceneSelection = useCallback(() => {
        selectRack(null);
        selectEquipment(null);
    }, [selectRack, selectEquipment]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form State for new server
    const [newServer, setNewServer] = useState<{
        name: string;
        model?: string;
        ipAddress: string;
        uPosition: number;
        uHeight: number;
        powerKw: number;
        type: 'server' | 'switch' | 'storage';
        status: 'normal' | 'warning' | 'critical' | 'offline';
        gpuModel?: string;
        flops?: number;
        carbonEmission?: number;
    }>({
        name: "SERVER-001",
        model: "",
        ipAddress: "",
        uPosition: 1,
        uHeight: 2,
        powerKw: 1.5,
        type: "server",
        status: "normal",
        gpuModel: "",
    });

    const [telemetry, setTelemetry] = useState<Record<string, any>>({});
    
    // 🔮 預測性熱場與異常分析狀態
    const [predictionHorizon, setPredictionHorizon] = useState<number>(0);
    const [predictedTemps, setPredictedTemps] = useState<Record<string, number>>({});
    const [predictedHotspots, setPredictedHotspots] = useState<number>(0);
    const [isPredictionLoading, setIsPredictionLoading] = useState<boolean>(false);
    const [thermalChartData, setThermalChartData] = useState<any[]>([]);
    const [chartActiveServerId, setChartActiveServerId] = useState<string | null>(null);
    const [isChartLoading, setIsChartLoading] = useState(false);

    // 獲取預測熱場資料
    const fetchPrediction = useCallback(async (horizonVal: number) => {
        if (horizonVal === 0) {
            setPredictedTemps({});
            setPredictedHotspots(0);
            return;
        }
        setIsPredictionLoading(true);
        try {
            const res = await authFetch(apiUrl(`/api/thermal/status?horizon=${horizonVal}`), { cache: "no-store" });
            if (res.ok) {
                const json = await res.json();
                const pTemps: Record<string, number> = {};
                (json.servers || []).forEach((s: any) => {
                    pTemps[s.server_id] = s.predicted_temperature;
                });
                setPredictedTemps(pTemps);
                setPredictedHotspots(json.predicted_hotspots_count);
            }
        } catch (e) { } finally {
            setIsPredictionLoading(false);
        }
    }, []);

    // 當時間滑桿改變時發起獲取
    useEffect(() => {
        fetchPrediction(predictionHorizon);
    }, [predictionHorizon, fetchPrediction]);

    // 當點選伺服器時，自動拉取預測多軸關聯數據
    useEffect(() => {
        if (selectedRack && selectedRack.servers.length > 0) {
            const firstServer = selectedRack.servers[0];
            setChartActiveServerId(firstServer.name);
        } else {
            setChartActiveServerId(null);
            setThermalChartData([]);
        }
    }, [selectedRackId]);

    useEffect(() => {
        if (!chartActiveServerId) return;
        
        let active = true;
        const fetchChartDetail = async () => {
            setIsChartLoading(true);
            try {
                const res = await authFetch(apiUrl(`/api/thermal/predict-detail?server_id=${chartActiveServerId}`), { cache: "no-store" });
                if (res.ok && active) {
                    const json = await res.json();
                    setThermalChartData(json.data || []);
                }
            } catch (e) {
            } finally {
                if (active) setIsChartLoading(false);
            }
        };
        
        fetchChartDetail();
        const interval = setInterval(fetchChartDetail, 5000);
        
        return () => {
            active = false;
            clearInterval(interval);
        };
    }, [chartActiveServerId]);

    // 🔮 雙相浸沒式冷卻深度遙測狀態
    const [immersionData, setImmersionData] = useState<any>(null);
    const [isImmersionLoading, setIsImmersionLoading] = useState(false);
    
    // 展會互動式模擬控制狀態
    const [simGpuLoad, setSimGpuLoad] = useState<number>(35); // kW
    const [simWaterFlow, setSimWaterFlow] = useState<number>(15); // LPM
    const [simSealLeak, setSimSealLeak] = useState<boolean>(false);
    const [simCloggedFilter, setSimCloggedFilter] = useState<boolean>(false);
    const [simWaterIntrusion, setSimWaterIntrusion] = useState<boolean>(false);

    const defaultGpuLoad = useMemo(() => {
        if (!selectedRack) return 35;
        return selectedRack.servers.reduce((sum, s) => sum + (s.flops ? s.flops * 0.15 : 4.5), 25.0);
    }, [selectedRackId]);

    // 拉取浸沒式冷卻化學與物理數據
    const fetchImmersionStatus = useCallback(async () => {
        if (!selectedRack) return;
        const tank_id = (selectedRack.name || "").trim().toUpperCase().replace(/\s+/g, "").replace(/_/g, "-");
        try {
            const res = await authFetch(apiUrl(`/api/immersion/status?tank_id=${tank_id}&tank_type=${selectedRack.type}`), { cache: "no-store" });
            if (res.ok) {
                const json = await res.json();
                setImmersionData(json);
            }
        } catch (e) {
            console.error("Failed to fetch immersion status", e);
        }
    }, [selectedRack?.name, selectedRack?.type]);

    // 當選中浸沒式槽體時，定時拉取深度化學遙測
    useEffect(() => {
        if (!selectedRackId || !selectedRack) {
            setImmersionData(null);
            return;
        }
        
        const isImmersion = selectedRack.type === 'immersion_single' || selectedRack.type === 'immersion_dual';
        if (!isImmersion) {
            setImmersionData(null);
            return;
        }

        fetchImmersionStatus();
        const interval = setInterval(fetchImmersionStatus, 3000); // 3秒輪詢一次，實現超高流暢動態聯動

        // 初始化模擬滑桿預設值
        setSimGpuLoad(defaultGpuLoad);
        setSimWaterFlow(15);
        setSimSealLeak(false);
        setSimCloggedFilter(false);
        setSimWaterIntrusion(false);

        return () => clearInterval(interval);
    }, [selectedRackId, selectedRack?.name, defaultGpuLoad, fetchImmersionStatus]);

    // 觸發觀眾模擬調控 API
    const triggerImmersionSimulation = async (params: {
        gpu_load_kw?: number;
        condenser_flow_lpm?: number;
        seal_leak?: boolean;
        clogged_filter?: boolean;
        water_intrusion?: boolean;
    }) => {
        if (!selectedRack) return;
        const tank_id = (selectedRack.name || "").trim().toUpperCase().replace(/\s+/g, "").replace(/_/g, "-");
        try {
            await authFetch(apiUrl("/api/immersion/simulate"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tank_id: tank_id,
                    tank_type: selectedRack.type,
                    ...params
                })
            });
            // 立即拉取更新
            fetchImmersionStatus();
        } catch (e) {
            console.error("Failed to apply simulator override", e);
        }
    };

    // 核心：動態覆寫 / 注入預測數值到 telemetry 中，使得 3D Canvas 自然渲染預測熱場
    const displayTelemetry = useMemo(() => {
        if (predictionHorizon === 0) return telemetry;
        
        const tCopy = { ...telemetry };
        Object.keys(predictedTemps).forEach((sid) => {
            const tempVal = predictedTemps[sid];
            const keysToInject = [
                sid,
                sid.toUpperCase(),
                sid.toLowerCase(),
                sid.replace("-", "_"),
                sid.replace("_", "-"),
                sid.replace("-", "_").toUpperCase(),
                sid.replace("-", "_").toLowerCase(),
                normalizeNodeId(sid)
            ];
            
            keysToInject.forEach((k) => {
                const prevRecord = tCopy[k] || {};
                tCopy[k] = { 
                    ...prevRecord, 
                    temperature: tempVal,
                    // 當預測溫度高於 55°C 時，模擬觸發風扇與泵浦的預判加速，供 3D 渲染動態反映！
                    fan_speed: tempVal > 55.0 ? 85.0 : (prevRecord.fan_speed || 40.0),
                    pump_a_rpm: tempVal > 55.0 ? 5100.0 : (prevRecord.pump_a_rpm || 3000.0),
                    pump_b_rpm: tempVal > 55.0 ? 5100.0 : (prevRecord.pump_b_rpm || 3000.0),
                    outlet_temp_c: tempVal > 55.0 ? 38.0 : (prevRecord.outlet_temp_c || 42.0),
                    inlet_temp_c: tempVal > 55.0 ? 28.5 : (prevRecord.inlet_temp_c || 30.0)
                };
            });
        });
        return tCopy;
    }, [telemetry, predictionHorizon, predictedTemps]);

    /** 網路線與 CDU 管路預設不顯示，由 HUD 按鈕切換 */
    const [showConnectionLines, setShowConnectionLines] = useState(false);

    const [editingServerId, setEditingServerId] = useState<string | null>(null);
    const [editingDraft, setEditingDraft] = useState<{
        name: string;
        model?: string;
        ipAddress: string;
        uPosition: number;
        uHeight: number;
        powerKw: number;
        type: 'server' | 'switch' | 'storage';
        status: 'normal' | 'warning' | 'critical' | 'offline';
        gpuModel?: string;
        flops?: number;
        carbonEmission?: number;
    } | null>(null);

    // Helper to find the next sequential name for a prefix
    const getNextName = (type: 'server' | 'switch' | 'storage') => {
        const prefix = type === 'switch' ? 'SW-' : type === 'storage' ? 'ST-' : 'SERVER-';
        const allNames = racks.flatMap(r => r.servers.map(s => s.name));
        const nums = allNames
            .filter(name => name.startsWith(prefix))
            .map(name => {
                const match = name.match(/\d+$/); // Match numbers at the end
                return match ? parseInt(match[0], 10) : 0;
            });
        const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;
        return `${prefix}${nextNum.toString().padStart(3, '0')}`;
    };

    useEffect(() => {
        if (selectedRack) {
            const nextType = selectedRack.type === 'network' ? 'switch' : 'server';
            setNewServer(prev => ({
                ...prev,
                type: nextType as any,
                name: getNextName(nextType)
            }));
        }
    }, [selectedRackId]);

    const modelOptionsByType = useMemo(() => {
        const map: Record<CommDeviceType, string[]> = {
            server: [],
            rack: [],
            tank: [],
            cdu: [],
            switch: [],
            crac: [],
            power: [],
        };
        for (const cfg of commConfigs) {
            const m = cfg.model.trim();
            if (!m) continue;
            if (!map[cfg.deviceType].includes(m)) {
                map[cfg.deviceType].push(m);
            }
        }
        // Fallback to defaults when persisted configs miss specific types (e.g. server).
        for (const cfg of DEFAULT_DEVICE_COMM_CONFIGS) {
            const m = cfg.model.trim();
            if (!m) continue;
            if (!map[cfg.deviceType].includes(m)) {
                map[cfg.deviceType].push(m);
            }
        }
        return map;
    }, [commConfigs]);

    const commDeviceTypeForRack = (rackType: string): CommDeviceType => {
        if (rackType === "network") return "switch";
        if (rackType === "immersion_single" || rackType === "immersion_dual") return "tank";
        return "rack";
    };
    const commDeviceTypeForEquipment = (type: string): CommDeviceType => {
        if (type === "cdu") return "cdu";
        if (type === "dashboard") return "server";
        if (type === "crac" || type === "chiller") return "crac";
        if (type === "pdu" || type === "ups") return "power";
        return "rack";
    };

    usePolling(async () => {
        try {
            const res = await authFetch(apiUrl("/metrics"), { cache: "no-store" });
            if (!res.ok) return;
            const json = await res.json();
            const tMap: Record<string, any> = {};
            (json.data || []).forEach((d: any) => {
                buildTelemetryKeys(d).forEach((key) => {
                    tMap[key] = d;
                });
            });
            setTelemetry(tMap);
            
            // 預測模式下同步定時更新預測溫度資料
            if (predictionHorizon > 0) {
                fetchPrediction(predictionHorizon);
            }
        } catch (e) { }
    }, { intervalMs: 5000, immediate: true });

    const syncSimulationTargets = useCallback(async () => {
        try {
            const modeRes = await authFetch(apiUrl("/api/system/mode"), { cache: "no-store" });
            if (!modeRes.ok) return;
            const modeJson = await modeRes.json();
            if (modeJson.mode !== "simulation") return;

            const servers = racks.flatMap((r) => r.servers);
            const racksInScope = racks;
            const equipmentsInScope = equipments;

            const cleanTargetName = (value: string | undefined) =>
                (value || "").trim().toUpperCase().replace(/\s+/g, "").replace(/_/g, "-");

            const methodByTarget: Record<string, string> = {};
            for (const s of servers) {
                const targetId = cleanTargetName(s.name || s.assetId);
                if (!targetId) continue;
                methodByTarget[targetId] = resolveCommMethodByModel(
                    commConfigs,
                    s.type === "switch" ? "switch" : "server",
                    s.model,
                    { simulationMode: true },
                );
            }
            for (const r of racksInScope) {
                const targetId = cleanTargetName(r.name);
                if (!targetId) continue;
                methodByTarget[targetId] = resolveCommMethodByModel(
                    commConfigs,
                    commDeviceTypeForRack(r.type),
                    r.model,
                    { simulationMode: true },
                );
            }
            for (const e of equipmentsInScope) {
                const targetId = cleanTargetName(e.name);
                if (!targetId) continue;
                methodByTarget[targetId] = resolveCommMethodByModel(
                    commConfigs,
                    commDeviceTypeForEquipment(e.type),
                    e.model,
                    { simulationMode: true },
                );
            }

            const targets = Object.keys(methodByTarget);
            if (targets.length === 0) return;

            const bindingItems = targets.map((targetId) => ({
                asset_id: targetId,
                display_name: targetId,
            }));
            if (bindingItems.length > 0) {
                await authFetch(apiUrl("/api/system/id_bindings/bulk_bind"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ items: bindingItems }),
                });
            }

            await authFetch(apiUrl("/api/system/simulate_targets"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ targets }),
            });
        } catch {
            // best effort only
        }
    }, [racks, equipments, commConfigs]);

    useEffect(() => {
        syncSimulationTargets();
    }, [syncSimulationTargets]);

    usePolling(
        async () => {
            await syncSimulationTargets();
        },
        { intervalMs: 8000, immediate: false },
    );

    const handleExport = () => {
        const json = exportState();
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "dcim_layout.json";
        link.click();
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            if (importState(content)) {
                alert("資料載入成功！ (Layout Imported)");
            } else {
                alert("載入失敗！檔案格式錯誤！ (Invalid format)");
            }
        };
        reader.readAsText(file);
    };

    const handleAddServer = () => {
        if (!selectedRack) return;

        // Enforce unique server name globally
        const allServers = racks.flatMap(r => r.servers);
        if (allServers.some(s => s.name === newServer.name)) {
            alert(`❌ 無法新增！伺服器名稱 ${newServer.name} 已經存在於其他機櫃中，名稱不可重複！`);
            return;
        }

        const success = addServerToRack(selectedRack.id, newServer);
        if (success) {
            // Suggest the NEXT name immediately after success
            setNewServer(prev => ({
                ...prev,
                name: getNextName(prev.type)
            }));
        } else {
            alert("❌ 無法新增！該 U 空間已被佔用或超出範圍！ (U-Space overlapping or out of bounds)");
        }
    };

    return (
        <div className="flex h-screen w-full bg-[#010613] text-slate-300 font-sans overflow-hidden">

            {/* 隱藏的檔案選擇器 */}
            <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={handleImport} />

            {/* 左側工具列 */}
            <div className="w-16 bg-[#020b1a] border-r border-[#1e3a8a] flex flex-col items-center py-6 gap-6 z-10 shadow-[2px_0_15px_rgba(6,182,212,0.1)]">
                <button className="p-3 bg-[#0a1e3f] rounded-xl text-cyan-400 hover:bg-cyan-900 border border-cyan-700 transition" title="Dashboard">
                    <Activity size={24} />
                </button>

                {isEditMode && (
                    <div className="flex flex-col gap-3 mt-2 pt-4 border-t border-cyan-900/50 w-full items-center">
                        <button onClick={() => addRack([Math.floor(Math.random() * 5), 0, Math.floor(Math.random() * 5)])} className="p-3 bg-[#020b1a] rounded-xl text-indigo-400 hover:text-indigo-300 hover:bg-[#0a1e3f] transition" title="Add RACK">
                            <Server size={24} />
                        </button>
                        <button onClick={() => addEquipment('crac', [Math.floor(Math.random() * 5), 0, Math.floor(Math.random() * 5)])} className="p-3 bg-[#020b1a] rounded-xl text-teal-400 hover:text-teal-300 hover:bg-[#0a1e3f] transition" title="Add CRAC (Cooling)">
                            <Thermometer size={24} />
                        </button>
                        <button onClick={() => addEquipment('pdu', [Math.floor(Math.random() * 5), 0, Math.floor(Math.random() * 5)])} className="p-3 bg-[#020b1a] rounded-xl text-orange-400 hover:text-orange-300 hover:bg-[#0a1e3f] transition" title="Add PDU (Power)">
                            <Zap size={24} />
                        </button>
                        <button onClick={() => addEquipment('cdu', [Math.floor(Math.random() * 5), 0, Math.floor(Math.random() * 5)])} className="p-3 bg-[#020b1a] rounded-xl text-cyan-300 hover:text-cyan-200 hover:bg-[#0a1e3f] transition" title="Add CDU (Liquid Cooling)">
                            <Box size={24} />
                        </button>
                        <button onClick={() => addEquipment('ups', [Math.floor(Math.random() * 5), 0, Math.floor(Math.random() * 5)])} className="p-3 bg-[#020b1a] rounded-xl text-yellow-500 hover:text-yellow-400 hover:bg-[#0a1e3f] transition" title="Add UPS (Power Backup)">
                            <Zap size={24} />
                        </button>
                        <button onClick={() => addEquipment('chiller', [Math.floor(Math.random() * 5), 0, Math.floor(Math.random() * 5)])} className="p-3 bg-[#020b1a] rounded-xl text-blue-500 hover:text-blue-400 hover:bg-[#0a1e3f] transition" title="Add Chiller (Water Cooling)">
                            <Activity size={24} />
                        </button>
                        <button onClick={() => addEquipment('dashboard', [Math.floor(Math.random() * 5), 0, Math.floor(Math.random() * 5)])} className="p-3 bg-[#020b1a] rounded-xl text-emerald-500 hover:text-emerald-400 hover:bg-[#0a1e3f] transition" title="Add Dashboard PC">
                            <MonitorIcon size={24} />
                        </button>
                        <button onClick={() => addRack([Math.floor(Math.random() * 5), 0, Math.floor(Math.random() * 5)], 'network')} className="p-3 bg-[#020b1a] rounded-xl text-purple-500 hover:text-purple-400 hover:bg-[#0a1e3f] transition" title="Add Network Rack (Switch)">
                            <Globe size={24} />
                        </button>
                        <button onClick={() => addRack([Math.floor(Math.random() * 5), 0, Math.floor(Math.random() * 5)], 'immersion_single')} className="p-3 bg-[#020b1a] rounded-xl text-sky-400 hover:text-sky-300 hover:bg-[#0a1e3f] transition" title="Add Single-Phase Immersion Tank (單相浸沒式)">
                            <Droplets size={24} />
                        </button>
                        <button onClick={() => addRack([Math.floor(Math.random() * 5), 0, Math.floor(Math.random() * 5)], 'immersion_dual')} className="p-3 bg-[#020b1a] rounded-xl text-violet-400 hover:text-violet-300 hover:bg-[#0a1e3f] transition" title="Add Dual-Phase Immersion Tank (雙相浸沒式)">
                            <Droplets size={24} />
                        </button>
                    </div>
                )}

                <div className="w-full border-t border-cyan-900/50 my-2"></div>
                <button onClick={handleExport} className="p-3 text-emerald-400 hover:text-emerald-300 hover:bg-[#0a1e3f] rounded-xl transition" title="Export Layout">
                    <Download size={24} />
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="p-3 text-pink-400 hover:text-pink-300 hover:bg-[#0a1e3f] rounded-xl transition" title="Import Layout">
                    <Upload size={24} />
                </button>
            </div>

            {/* 中央 3D 視窗 */}
            <div className="flex-1 relative overflow-hidden min-w-0 min-h-0">
                {/* HUD Overlay */}
                <div className="absolute top-4 left-4 z-10 pointer-events-none">
                    <h1 className="-ml-9 text-2xl font-black italic tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] flex items-center gap-3">
                        <Server /> {t.title}
                        <span className="text-white/20 mx-2 text-sm">|</span>
                        <span className="text-cyan-200 text-lg not-italic tracking-normal">
                            {locations.find(l => l.id === currentLocationId)?.name || t.unknownSite}
                        </span>
                    </h1>
                    <p className="text-xs text-cyan-700 font-mono mt-1 uppercase">
                        {t.realtime} • {locations.find(l => l.id === currentLocationId)?.type === 'region' ? t.regionView : t.floorView}
                    </p>
                </div>

                {/* Edit Mode HUD：編輯／檢視 + 其下連接線開關 */}
                <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
                    <button
                        type="button"
                        onClick={() => setEditMode(!isEditMode)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold tracking-widest transition-all border ${isEditMode ? 'bg-cyan-600 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.5)]' : 'bg-[#0a1e3f]/80 border-[#1e3a8a] text-slate-400 hover:text-white'}`}
                    >
                        {isEditMode ? <Edit size={16} /> : <Lock size={16} />}
                        {isEditMode ? t.editMode : t.viewOnly}
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowConnectionLines((v) => !v)}
                        title={showConnectionLines ? t.connectionLinesHide : t.connectionLinesShow}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all border pointer-events-auto ${showConnectionLines ? 'bg-emerald-900/70 border-emerald-500/60 text-emerald-200' : 'bg-[#0a1e3f]/80 border-[#1e3a8a] text-slate-500 hover:text-slate-200'}`}
                    >
                        <Link2 size={14} />
                        {showConnectionLines ? t.connectionLinesHide : t.connectionLinesShow}
                    </button>
                </div>

                <TwinsSceneCanvas
                    locationRacks={locationRacks}
                    locationEquipments={locationEquipments}
                    selectedRackId={selectedRackId}
                    telemetry={displayTelemetry}
                    showConnectionLines={showConnectionLines}
                    onPointerMissed={clearSceneSelection}
                />

                {/* 🔮 預測性熱場時序控制面板 */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-3 rounded-2xl border border-cyan-500/40 bg-[#020b1e]/90 p-5 pb-5 text-slate-200 shadow-[0_0_25px_rgba(6,182,212,0.2),inset_0_1px_1px_rgba(255,255,255,0.15)] backdrop-blur-lg pointer-events-auto min-w-[440px]">
                    <div className="flex w-full items-center justify-between gap-4 border-b border-slate-800 pb-2">
                        <span className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-cyan-400">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${predictionHorizon > 0 ? 'bg-amber-400' : 'bg-cyan-400'}`}></span>
                                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${predictionHorizon > 0 ? 'bg-amber-500' : 'bg-cyan-500'}`}></span>
                            </span>
                            {predictionHorizon === 0 ? "🔮 實時熱場監測模式" : `🔮 預測熱場模式 (+${predictionHorizon} 分鐘)`}
                        </span>
                        {predictionHorizon > 0 ? (
                            <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[9px] font-bold text-amber-300 border border-amber-500/30 animate-pulse">
                                預判冷卻運作中 ({predictedHotspots} 熱點預警)
                            </span>
                        ) : (
                            <span className="rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-[9px] font-bold text-cyan-300 border border-cyan-500/30">
                                遙測動態更新中
                            </span>
                        )}
                    </div>
                    
                    <div className="flex w-full items-center gap-3 mt-0.5">
                        <span className="text-[10px] font-semibold text-slate-400 w-8 text-right">實時</span>
                        <input
                            type="range"
                            min="0"
                            max="60"
                            step="15"
                            value={predictionHorizon === 0 ? 0 : predictionHorizon === 15 ? 15 : predictionHorizon === 30 ? 30 : predictionHorizon === 60 ? 45 : 60}
                            onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (val === 0) setPredictionHorizon(0);
                                else if (val === 15) setPredictionHorizon(15);
                                else if (val === 30) setPredictionHorizon(30);
                                else if (val === 45) setPredictionHorizon(60);
                                else if (val === 60) setPredictionHorizon(120);
                            }}
                            className="flex-1 accent-cyan-400 h-1 bg-slate-800 rounded-lg cursor-pointer appearance-none outline-none"
                        />
                        <span className="text-[10px] font-semibold text-slate-400 w-10">未來 2h</span>
                    </div>
                    
                    {/* 時序刻度標籤 */}
                    <div className="flex w-full justify-between text-[9px] font-semibold text-slate-500 px-9 mt-0.5">
                        <span className={predictionHorizon === 0 ? "text-cyan-400 font-bold scale-105 transition-all" : "hover:text-slate-300 cursor-pointer transition-all"} onClick={() => setPredictionHorizon(0)}>即時</span>
                        <span className={predictionHorizon === 15 ? "text-cyan-400 font-bold scale-105 transition-all" : "hover:text-slate-300 cursor-pointer transition-all"} onClick={() => setPredictionHorizon(15)}>+15m</span>
                        <span className={predictionHorizon === 30 ? "text-cyan-400 font-bold scale-105 transition-all" : "hover:text-slate-300 cursor-pointer transition-all"} onClick={() => setPredictionHorizon(30)}>+30m</span>
                        <span className={predictionHorizon === 60 ? "text-cyan-400 font-bold scale-105 transition-all" : "hover:text-slate-300 cursor-pointer transition-all"} onClick={() => setPredictionHorizon(60)}>+1h</span>
                        <span className={predictionHorizon === 120 ? "text-cyan-400 font-bold scale-105 transition-all" : "hover:text-slate-300 cursor-pointer transition-all"} onClick={() => setPredictionHorizon(120)}>+2h</span>
                    </div>
                </div>
            </div>

            {/* 右側屬性面板 (Room) */}
            {isEditMode && !selectedRack && !selectedEquipment && (
                <div className="w-80 bg-[#020b1a] border-l border-[#1e3a8a] flex flex-col z-10 shadow-[-2px_0_15px_rgba(6,182,212,0.1)]">
                    <div className="p-4 border-b border-[#1e3a8a] flex justify-between items-center bg-gradient-to-r from-transparent to-[#0a1e3f]">
                        <h2 className="text-cyan-400 font-bold tracking-widest uppercase text-xs">Room Settings</h2>
                    </div>
                    <div className="p-4 flex flex-col gap-6 overflow-y-auto flex-1">
                        <div className="bg-[#03112b] p-4 rounded-lg border border-slate-800">
                            <label className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-2 block">Room Name</label>
                            <input
                                type="text"
                                value={locations.find(l => l.id === currentLocationId)?.name || ''}
                                onChange={(e) => updateLocationName(currentLocationId, e.target.value)}
                                className="w-full bg-[#010613] border border-cyan-900/30 p-2 rounded text-cyan-100 text-sm outline-none focus:border-cyan-400 transition-colors mb-4"
                            />
                            
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-2 block font-bold text-blue-400">West Wall (-X)</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number" step="0.6"
                                                value={locations.find(l => l.id === currentLocationId)?.xMin ?? -10}
                                                onChange={(e) => updateLocationProps(currentLocationId, { xMin: Number(e.target.value) })}
                                                className="w-full bg-[#010613] border border-cyan-900/30 p-2 rounded text-cyan-100 text-sm outline-none focus:border-cyan-400 transition-colors"
                                            />
                                            <span className="text-[10px] text-slate-600">m</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-2 block font-bold text-blue-400">East Wall (+X)</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number" step="0.6"
                                                value={locations.find(l => l.id === currentLocationId)?.xMax ?? 10}
                                                onChange={(e) => updateLocationProps(currentLocationId, { xMax: Number(e.target.value) })}
                                                className="w-full bg-[#010613] border border-cyan-900/30 p-2 rounded text-cyan-100 text-sm outline-none focus:border-cyan-400 transition-colors"
                                            />
                                            <span className="text-[10px] text-slate-600">m</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-2 block font-bold text-emerald-400">North Wall (-Z)</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number" step="0.6"
                                                value={locations.find(l => l.id === currentLocationId)?.zMin ?? -7.5}
                                                onChange={(e) => updateLocationProps(currentLocationId, { zMin: Number(e.target.value) })}
                                                className="w-full bg-[#010613] border border-cyan-900/30 p-2 rounded text-cyan-100 text-sm outline-none focus:border-cyan-400 transition-colors"
                                            />
                                            <span className="text-[10px] text-slate-600">m</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-2 block font-bold text-emerald-400">South Wall (+Z)</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number" step="0.6"
                                                value={locations.find(l => l.id === currentLocationId)?.zMax ?? 7.5}
                                                onChange={(e) => updateLocationProps(currentLocationId, { zMax: Number(e.target.value) })}
                                                className="w-full bg-[#010613] border border-cyan-900/30 p-2 rounded text-cyan-100 text-sm outline-none focus:border-cyan-400 transition-colors"
                                            />
                                            <span className="text-[10px] text-slate-600">m</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <label className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-2 block">Door Position</label>
                            <select
                                value={locations.find(l => l.id === currentLocationId)?.doorPosition || 'right'}
                                onChange={(e) => updateLocationProps(currentLocationId, { doorPosition: e.target.value as any })}
                                className="w-full bg-[#010613] border border-cyan-900/30 p-2 rounded text-cyan-100 text-sm outline-none focus:border-cyan-400 transition-colors"
                            >
                                <option value="back">Back Wall (-Z)</option>
                                <option value="left">Left Wall (-X)</option>
                                <option value="right">Right Wall (+X)</option>
                            </select>
                        </div>
                        
                        <div className="mt-8 pt-4">
                            <button
                                onClick={() => {
                                    if (locations.length <= 1) {
                                        alert("❌ 無法刪除！必須至少保留一個機房！");
                                        return;
                                    }
                                    const pwd = window.prompt("⚠️ 警告：這將會永久刪除此機房與內含的所有設備！\\n請輸入管理員密碼(admin)以確認：");
                                    if (pwd === "admin") {
removeLocation(currentLocationId);
                                    } else if (pwd !== null) {
                                        alert("❌ 密碼錯誤！刪除已取消。");
                                    }
                                }}
                                className="w-full bg-red-950/30 hover:bg-red-900 border border-red-900/50 text-red-500 hover:text-white font-bold tracking-widest p-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                <Trash size={16} /> Delete Room
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 右側屬性面板 (Rack) */}
            {selectedRack && (
                <div className="w-[500px] bg-[#020b1a] border-l border-[#1e3a8a] flex flex-col z-10 shadow-[-2px_0_15px_rgba(6,182,212,0.1)]">
                    <div className="p-4 border-b border-[#1e3a8a] flex justify-between items-center bg-gradient-to-r from-transparent to-[#0a1e3f]">
                        <h2 className="text-cyan-400 font-bold tracking-widest uppercase text-xs">{t.rackSettings}</h2>
                        {isEditMode && (
                            <button onClick={() => removeRack(selectedRack.id)} className="text-red-500 hover:text-red-400 transition" title="Delete Rack">
                                <Trash size={16} />
                            </button>
                        )}
                    </div>

                    <div className="p-4 flex flex-col gap-6 overflow-y-auto flex-1">
                        {/* 基本資訊 */}
                        <div className="bg-[#03112b] p-4 rounded-lg border border-slate-800">
                            <label className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-2 block">Rack Name</label>
                            <input
                                type="text"
                                value={selectedRack.name}
                                onChange={(e) => updateRackName(selectedRack.id, e.target.value)}
                                className="w-full bg-[#010613] border border-cyan-900/30 p-2 rounded text-cyan-100 text-sm outline-none focus:border-cyan-400 transition-colors"
                            />
                            <label className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mt-3 mb-2 block">Model</label>
                            <select
                                value={selectedRack.model || ""}
                                onChange={(e) => updateRackModel(selectedRack.id, e.target.value)}
                                className="w-full bg-[#010613] border border-cyan-900/30 p-2 rounded text-cyan-100 text-sm outline-none focus:border-cyan-400 transition-colors"
                            >
                                <option value="">(Custom)</option>
                                {modelOptionsByType[commDeviceTypeForRack(selectedRack.type)].map((model) => (
                                    <option key={model} value={model}>{model}</option>
                                ))}
                            </select>
                            <label className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mt-3 mb-2 block">Host / IP</label>
                            <input
                                type="text"
                                value={selectedRack.ipAddress || ""}
                                onChange={(e) => updateRackIp(selectedRack.id, e.target.value)}
                                placeholder="e.g. 192.168.1.10"
                                className="w-full bg-[#010613] border border-cyan-900/30 p-2 rounded text-cyan-100 text-sm outline-none focus:border-cyan-400 transition-colors"
                            />

                            {/* 旋轉控制 */}
                            {isEditMode && (
                                <div className="mt-4 border-t border-slate-800/50 pt-3">
                                    <label className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-2 block">Direction Control</label>
                                    <div className="flex gap-2">
                                        <button onClick={() => updateRackRotation(selectedRack.id, [0, selectedRack.rotation[1] + Math.PI / 2, 0])} className="flex-1 bg-[#0a1e3f] hover:bg-cyan-900 border border-cyan-800 text-cyan-400 p-2 rounded transition text-xs font-bold tracking-widest flex items-center justify-center gap-1">
                                            ↺ 左轉 90°
                                        </button>
                                        <button onClick={() => updateRackRotation(selectedRack.id, [0, selectedRack.rotation[1] - Math.PI / 2, 0])} className="flex-1 bg-[#0a1e3f] hover:bg-cyan-900 border border-cyan-800 text-cyan-400 p-2 rounded transition text-xs font-bold tracking-widest flex items-center justify-center gap-1">
                                            ↻ 右轉 90°
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 機櫃容量與電力 */}
                        <div className="bg-[#03112b] p-4 rounded-lg border border-slate-800">
                            <div className="flex justify-between text-xs text-slate-400 mb-1">
                                <span>Power Usage</span>
                                <span className="text-cyan-400">{selectedRack.servers.reduce((s, x) => s + x.powerKw, 0).toFixed(1)} / {selectedRack.maxPowerKw} kW</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-4">
                                <div
                                    className="h-full bg-cyan-500"
                                    style={{ width: `${(selectedRack.servers.reduce((sum, s) => sum + s.powerKw, 0) / selectedRack.maxPowerKw) * 100}%` }}
                                ></div>
                            </div>

                            <div className="flex justify-between text-xs text-slate-400 mb-1">
                                <span>U Space Used</span>
                                <span className="text-cyan-400">{selectedRack.servers.reduce((s, x) => s + x.uHeight, 0)} / {selectedRack.uCapacity} U</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500"
                                    style={{ width: `${(selectedRack.servers.reduce((sum, s) => sum + s.uHeight, 0) / selectedRack.uCapacity) * 100}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Network Uplink Selection */}
                        {(selectedRack.type === 'server' || selectedRack.type === 'immersion_single' || selectedRack.type === 'immersion_dual') && (
                            <div className="bg-[#03112b] p-4 rounded-lg border border-purple-900/30">
                                <div className="flex items-center gap-2 mb-3">
                                    <Link2 size={14} className="text-purple-400" />
                                    <h3 className="text-xs font-bold text-purple-400 tracking-widest uppercase">Network Uplink</h3>
                                </div>
                                <select
                                    className="w-full bg-[#0a1e3f] border border-purple-800 p-2 rounded text-white text-[11px] outline-none mb-3"
                                    value={selectedRack.connectedNetworkRackId || ""}
                                    onChange={(e) => updateRackConnection(selectedRack.id, e.target.value)}
                                >
                                    <option value="">Auto-Hub (Default)</option>
                                    {racks.filter(r => r.type === 'network').map(netRack => (
                                        <option key={netRack.id} value={netRack.id}>{netRack.name}</option>
                                    ))}
                                </select>

                                {selectedRack.connectedNetworkRackId && (
                                    <div className="mt-2 border-t border-purple-900/30 pt-3">
                                        <label className="text-[10px] text-purple-400/60 uppercase tracking-[0.15em] mb-1.5 block">Select Destination Switch</label>
                                        <select
                                            className="w-full bg-[#0a1e3f] border border-purple-800 p-2 rounded text-white text-[11px] outline-none"
                                            value={selectedRack.connectedSwitchId || ""}
                                            onChange={(e) => updateRackConnection(selectedRack.id, selectedRack.connectedNetworkRackId || null, e.target.value)}
                                        >
                                            <option value="">Automatic (Top-most)</option>
                                            {(racks.find(r => r.id === selectedRack.connectedNetworkRackId)?.servers || [])
                                                .filter(s => s.type === 'switch')
                                                .map(sw => (
                                                    <option key={sw.id} value={sw.id}>{sw.name} (U{sw.uPosition})</option>
                                                ))
                                            }
                                        </select>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* CDU Selection (Only for Server Rack & Single Phase Immersion) */}
                        {(selectedRack.type === 'server' || selectedRack.type === 'immersion_single') && (() => {
                            const availableCdus = equipments.filter(e => e.locationId === currentLocationId && e.type === 'cdu');
                            if (availableCdus.length === 0) return null;
                            const currentCdu = availableCdus.find(e => e.connectedRackIds?.includes(selectedRack.id));
                            
                            return (
                                <div className="bg-[#03112b] p-4 rounded-lg border border-cyan-900/30">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Thermometer size={14} className="text-cyan-400" />
                                        <h3 className="text-xs font-bold text-cyan-400 tracking-widest uppercase">Coolant Pipe (CDU)</h3>
                                    </div>
                                    <select
                                        className="w-full bg-[#0a1e3f] border border-cyan-800 p-2 rounded text-white text-[11px] outline-none mb-1"
                                        value={currentCdu?.id || ""}
                                        onChange={(e) => assignRackToCdu(selectedRack.id, e.target.value || null)}
                                    >
                                        <option value="">None (Standalone)</option>
                                        {availableCdus.map(cdu => (
                                            <option key={cdu.id} value={cdu.id}>{cdu.name}</option>
                                        ))}
                                    </select>
                                </div>
                            );
                        })()}

                        {/* AI & ESG Metrics (Aggregated) */}
                        {(() => {
                            const totalFlops = selectedRack.servers.reduce((sum, s) => sum + (s.flops || 0), 0);
                            const totalCarbon = selectedRack.servers.reduce((sum, s) => sum + (s.carbonEmission || 0), 0);
                            const uniqueGpus = Array.from(new Set(selectedRack.servers.map(s => s.gpuModel).filter(Boolean)));
                            
                            return (
                                <div className="bg-[#03112b] p-4 rounded-lg border border-emerald-900/30">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Cpu size={14} className="text-emerald-400" />
                                        <h3 className="text-xs font-bold text-emerald-400 tracking-widest uppercase">AI & ESG Metrics</h3>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-[10px] text-emerald-400/60 uppercase tracking-[0.15em] mb-1.5 block">GPU Summary (晶片統計)</label>
                                            <div className="w-full bg-[#0a1e3f] border border-emerald-800/50 p-2 rounded text-emerald-300 text-[11px] font-mono min-h-[34px] flex items-center">
                                                {uniqueGpus.length > 0 ? uniqueGpus.join(" | ") : "No GPUs detected"}
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] text-emerald-400/60 uppercase tracking-[0.15em] mb-1.5 block">Total Compute (PFLOPS)</label>
                                                <div className="w-full bg-[#0a1e3f] border border-emerald-800/50 p-2 rounded text-emerald-300 text-[11px] font-mono">
                                                    {totalFlops > 0 ? totalFlops.toFixed(1) : "0"}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] flex items-center gap-1 text-emerald-400/60 uppercase tracking-[0.15em] mb-1.5 block">
                                                    <Leaf size={10} className="inline-block -mt-0.5" /> Total CO2e (kg/mo)
                                                </label>
                                                <div className="w-full bg-[#0a1e3f] border border-emerald-800/50 p-2 rounded text-emerald-300 text-[11px] font-mono">
                                                    {totalCarbon > 0 ? totalCarbon.toFixed(1) : "0"}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* 🔮 智慧預測熱場與冷卻多軸分析 */}
                        {chartActiveServerId && thermalChartData.length > 0 && (
                            <div className="bg-[#03112b] p-4 rounded-lg border border-cyan-900/30">
                                <div className="flex items-center justify-between mb-3 border-b border-cyan-800/30 pb-1">
                                    <h3 className="text-xs font-bold text-cyan-400 flex items-center gap-1.5 tracking-widest uppercase whitespace-nowrap">
                                        <span>🔮 熱場冷卻多軸預測 ({chartActiveServerId})</span>
                                    </h3>
                                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">PREDICTIVE DASH</span>
                                </div>
                                <div className="h-44 w-full text-[10px] select-none">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={thermalChartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                            <XAxis dataKey="time_label" stroke="#475569" fontSize={8} />
                                            <YAxis yAxisId="left" stroke="#eab308" domain={[0, 100]} fontSize={8} />
                                            <YAxis yAxisId="right" orientation="right" stroke="#ef4444" domain={[20, 80]} fontSize={8} />
                                            <RechartsTooltip contentStyle={{ backgroundColor: "#020617", border: "1px solid #1e3a8a", fontSize: "9px" }} />
                                            <Legend wrapperStyle={{ fontSize: '8px', marginTop: '2px' }} />
                                            <Line yAxisId="left" name="負載 (%)" type="monotone" dataKey="cpu_usage" stroke="#eab308" strokeWidth={1.5} dot={false} />
                                            <Line yAxisId="right" name="晶片溫 (°C)" type="monotone" dataKey="temperature" stroke="#ef4444" strokeWidth={2} activeDot={{ r: 4 }} />
                                            <Line yAxisId="right" name="出回水溫 (°C)" type="monotone" dataKey="coolant_inlet_temp" stroke="#10b981" strokeWidth={1.2} strokeDasharray="3 3" dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        {/* 🔮 雙相/單相浸沒式冷卻深度遙測面板 */}
                        {(selectedRack.type === 'immersion_single' || selectedRack.type === 'immersion_dual') && immersionData && (
                            <div className="bg-[#03112b] p-4 rounded-lg border border-cyan-500/30 flex flex-col gap-4">
                                <div className="flex items-center justify-between border-b border-cyan-800/30 pb-2">
                                    <div className="flex items-center gap-1.5">
                                        <Droplets size={14} className="text-cyan-400 animate-pulse" />
                                        <h3 className="text-xs font-bold text-cyan-400 tracking-widest uppercase">
                                            {selectedRack.type === 'immersion_single' ? '單相浸沒深度遙測' : '雙相浸沒深度遙測'}
                                        </h3>
                                    </div>
                                    <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[8px] font-bold text-cyan-300 border border-cyan-500/30 font-mono">
                                        {selectedRack.type === 'immersion_single' ? 'FORCED CONVECTION' : 'PHASE-CHANGE'}
                                    </span>
                                </div>

                                {/* 1. 🧪 槽體剖面視圖與物理流場/沸騰 */}
                                <div className="grid grid-cols-1 gap-3">
                                    {selectedRack.type === 'immersion_single' ? (
                                        <SinglePhaseTankView 
                                            pumpFlow={simWaterFlow} 
                                            maxGpuTemp={immersionData.max_gpu_temp || 45.0} 
                                            deltaT={immersionData.delta_t || 15.0} 
                                        />
                                    ) : (
                                        <TwoPhaseTankView 
                                            voidFraction={immersionData.void_fraction} 
                                            levelPercent={(immersionData.fluid_level_mm / 500) * 100}
                                            isCondensating={immersionData.fused_loss_rate_ml_hr < 120} 
                                        />
                                    )}
                                    
                                    {selectedRack.type === 'immersion_single' ? (
                                        <div className="bg-[#010613]/60 border border-cyan-900/30 p-2.5 rounded-lg text-[10px] font-mono space-y-1.5">
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">進油溫度 (Inlet Temp):</span>
                                                <span className="text-cyan-300 font-bold">{immersionData.condenser_inlet_temp || 35.0} °C</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">出油溫度 (Outlet Temp):</span>
                                                <span className="text-cyan-300 font-bold">{immersionData.outlet_temp || (35.0 + (immersionData.delta_t || 15.0)).toFixed(1)} °C</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">對流溫升 (ΔT):</span>
                                                <span className="text-cyan-300 font-bold">{immersionData.delta_t || 15.0} °C</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">動力黏度 (Viscosity):</span>
                                                <span className="text-cyan-300 font-bold">{immersionData.viscosity_cst || 10.0} cSt</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-400">熱點機率 (Hotspot Prob):</span>
                                                <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                                    (immersionData.hotspot_prob || 0.0) >= 75.0 
                                                        ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-bounce' 
                                                        : (immersionData.hotspot_prob || 0.0) >= 40.0
                                                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                }`}>
                                                    {Number(immersionData.hotspot_prob || 0.0).toFixed(1)}%
                                                </span>
                                            </div>
                                            {immersionData.should_throttle && (
                                                <div className="bg-red-950/40 border border-red-500/30 text-red-300 p-1.5 rounded text-[9px] font-sans font-semibold animate-pulse text-center">
                                                    ⚠️ 局部對流熱飽和！已啟動功耗壓制保護！
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="bg-[#010613]/60 border border-cyan-900/30 p-2.5 rounded-lg text-[10px] font-mono space-y-1.5">
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">氣泡佔比 (Void Fraction):</span>
                                                <span className="text-cyan-300 font-bold">{immersionData.void_fraction}%</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-400">沸騰狀態 (Regime):</span>
                                                <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                                    immersionData.boiling_regime === 'film' 
                                                        ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-bounce' 
                                                        : immersionData.boiling_regime === 'transition'
                                                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                }`}>
                                                    {immersionData.boiling_regime === 'film' ? 'Film (膜狀)' : immersionData.boiling_regime === 'transition' ? 'Transition (過渡)' : 'Nucleate (核沸騰)'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">液流失率 (Evaporation):</span>
                                                <span className={`font-bold ${immersionData.leak_severity === 'critical' ? 'text-red-400 font-bold' : 'text-slate-300'}`}>
                                                    {immersionData.fused_loss_rate_ml_hr} mL/hour
                                                </span>
                                            </div>
                                            {immersionData.should_throttle && (
                                                <div className="bg-red-950/40 border border-red-500/30 text-red-300 p-1.5 rounded text-[9px] font-sans font-semibold animate-pulse text-center">
                                                    ⚠️ CHF 臨界乾涸！已啟動功耗壓制！
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* 2. 🕸️ 流體健康度五軸雷達圖 */}
                                <div className="bg-[#020712] border border-cyan-500/20 rounded-xl p-2.5 shadow-[inset_0_0_15px_rgba(6,182,212,0.1)] flex flex-col items-center">
                                    <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-widest self-start mb-2">
                                        {selectedRack.type === 'immersion_single' ? '🕸️ 單相冷卻油劣化雷達' : '🕸️ 流體健康劣化雷達'}
                                    </span>
                                    <div className="h-40 w-full text-[9px] select-none">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadarChart cx="50%" cy="50%" outerRadius="65%" margin={{ top: 10, right: 30, left: 30, bottom: 10 }} data={
                                                selectedRack.type === 'immersion_single' ? [
                                                    { subject: '介電強度', A: (immersionData.dielectric_strength_kv || 50.0) * 2.0, fullMark: 100 },
                                                    { subject: '總酸值', A: (immersionData.tan_mg_koh_g || 0.02) * 333.0, fullMark: 100 },
                                                    { subject: '含水量', A: (immersionData.water_content_ppm || 15.0) * 0.5, fullMark: 100 },
                                                    { subject: '黏度偏離', A: 35, fullMark: 100 },
                                                    { subject: '微粒雜質', A: 20, fullMark: 100 }
                                                ] : [
                                                    { subject: '電導率', A: immersionData.conductivity_us_cm * 100, fullMark: 100 },
                                                    { subject: '酸化度', A: (8 - immersionData.ph_value) * 25, fullMark: 100 },
                                                    { subject: '含水量', A: immersionData.water_content_ppm * 2, fullMark: 100 },
                                                    { subject: '腐蝕風險', A: immersionData.hf_corrosion_risk === 'high' ? 95 : immersionData.hf_corrosion_risk === 'medium' ? 50 : 15, fullMark: 100 },
                                                    { subject: '雜質微粒', A: 25, fullMark: 100 }
                                                ]
                                            }>
                                                <PolarGrid stroke="#0f172a" />
                                                <PolarAngleAxis dataKey="subject" stroke="#64748b" fontSize={7} />
                                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} stroke="#0f172a" />
                                                <Radar name="Fluid Health" dataKey="A" stroke="#22d3ee" fill="#0891b2" fillOpacity={0.4} />
                                            </RadarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* 3. ⏳ 過濾器壽命與工單自癒連動 */}
                                <div className="bg-[#010613]/80 border border-slate-800 p-3 rounded-lg space-y-2">
                                    <div className="flex items-center justify-between text-[10px]">
                                        <span className="text-slate-400 font-bold">
                                            {selectedRack.type === 'immersion_single' ? '單相循環過濾器壽命:' : '循環過濾器壽命:'}
                                        </span>
                                        <span className={`font-mono font-bold ${
                                            immersionData.filter_status === 'critical' ? 'text-red-400 font-bold' : 'text-emerald-400'
                                        }`}>
                                            {immersionData.filter_progress}% (約 {immersionData.filter_days_remaining} 天)
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full transition-all duration-1000 ${
                                                immersionData.filter_status === 'critical' 
                                                    ? 'bg-red-500' 
                                                    : immersionData.filter_status === 'warning'
                                                        ? 'bg-amber-500'
                                                        : 'bg-emerald-500'
                                            }`}
                                            style={{ width: `${immersionData.filter_progress}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between items-center text-[9px] text-slate-400 pt-1">
                                        <span>壓差: {immersionData.filter_dp_psi} PSI</span>
                                        {immersionData.trigger_filter_maintenance && (
                                            <span className="flex items-center gap-0.5 text-amber-400 font-bold animate-pulse">
                                                🔧 濾芯工單已自癒發起
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* 4. ☢️ 化學警告 */}
                                {immersionData.chem_severity !== 'normal' && (
                                    <div className={`p-2.5 rounded-lg border text-[10px] space-y-1 ${
                                        immersionData.chem_severity === 'critical'
                                            ? 'bg-red-950/40 border-red-500/30 text-red-300'
                                            : 'bg-amber-950/40 border-amber-500/30 text-amber-300'
                                    }`}>
                                        <div className="font-bold flex items-center gap-1">
                                            <span>⚠️ {immersionData.chem_severity === 'critical' ? '最高級化學腐蝕警告' : '化學性質劣化警告'}</span>
                                            {immersionData?.purification_state !== 'standby' && (
                                                <span className="text-[8px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-1 py-0.5 rounded font-mono animate-pulse">
                                                    線上淨化中
                                                </span>
                                            )}
                                        </div>
                                        <p className="leading-relaxed">{immersionData.chem_description}</p>
                                    </div>
                                )}

                                {/* 5. 🎛️ 觀眾互動模擬調控 */}
                                <div className="bg-[#020b1a] border border-cyan-800/40 p-3 rounded-lg space-y-3">
                                    <div className="flex items-center justify-between border-b border-cyan-800/30 pb-1.5">
                                        <span className="text-[10px] font-bold text-cyan-400 flex items-center gap-1">
                                            <span>🎛️ 展場互動式模擬調控</span>
                                        </span>
                                        <span className="text-[8px] text-slate-500 font-mono">OP CONTROL</span>
                                    </div>

                                    <div className="space-y-2">
                                        <div>
                                            <div className="flex justify-between text-[9px] text-slate-400 mb-1">
                                                <span>GPU 熱通量 (功率):</span>
                                                <span className="text-cyan-300 font-mono">{Number(simGpuLoad).toFixed(1)} kW</span>
                                            </div>
                                            <input 
                                                type="range" min="0" max="100" step="5"
                                                value={simGpuLoad}
                                                onChange={(e) => {
                                                    const val = Number(e.target.value);
                                                    setSimGpuLoad(val);
                                                    triggerImmersionSimulation({ gpu_load_kw: val });
                                                }}
                                                className="w-full accent-cyan-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
                                            />
                                        </div>

                                        <div>
                                            <div className="flex justify-between text-[9px] text-slate-400 mb-1">
                                                <span>{selectedRack.type === 'immersion_single' ? '循環泵浦流量:' : '冷凝水量流量:'}</span>
                                                <span className="text-cyan-300 font-mono">{simWaterFlow} LPM</span>
                                            </div>
                                            <input 
                                                type="range" min="0" max="150" step="5"
                                                value={simWaterFlow}
                                                onChange={(e) => {
                                                    const val = Number(e.target.value);
                                                    setSimWaterFlow(val);
                                                    triggerImmersionSimulation({ condenser_flow_lpm: val });
                                                }}
                                                className="w-full accent-cyan-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 pt-1.5">
                                            <button 
                                                onClick={() => {
                                                    const val = !simSealLeak;
                                                    setSimSealLeak(val);
                                                    triggerImmersionSimulation({ seal_leak: val });
                                                }}
                                                className={`text-[9px] font-bold p-1.5 rounded transition ${
                                                    simSealLeak 
                                                        ? 'bg-red-500/20 border border-red-500 text-red-400 font-bold' 
                                                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-300'
                                                }`}
                                            >
                                                {simSealLeak 
                                                    ? (selectedRack.type === 'immersion_single' ? '🔴 冷卻油洩漏中' : '🔴 密封洩漏中') 
                                                    : (selectedRack.type === 'immersion_single' ? '⚪ 模擬冷卻油洩漏' : '⚪ 模擬密封洩漏')}
                                            </button>

                                            <button 
                                                onClick={() => {
                                                    const val = !simCloggedFilter;
                                                    setSimCloggedFilter(val);
                                                    triggerImmersionSimulation({ clogged_filter: val });
                                                }}
                                                className={`text-[9px] font-bold p-1.5 rounded transition ${
                                                    simCloggedFilter 
                                                        ? 'bg-amber-500/20 border border-amber-500 text-amber-400 font-bold animate-pulse' 
                                                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-300'
                                                }`}
                                            >
                                                {simCloggedFilter ? '🟠 濾芯堵塞中' : '⚪ 模擬濾芯堵塞'}
                                            </button>

                                            <button 
                                                onClick={() => {
                                                    const val = !simWaterIntrusion;
                                                    setSimWaterIntrusion(val);
                                                    triggerImmersionSimulation({ water_intrusion: val });
                                                }}
                                                className={`text-[9px] font-bold p-1.5 rounded transition col-span-2 ${
                                                    simWaterIntrusion 
                                                        ? 'bg-red-500/20 border border-red-500 text-red-400 font-bold animate-pulse' 
                                                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-300'
                                                }`}
                                            >
                                                {simWaterIntrusion 
                                                    ? (selectedRack.type === 'immersion_single' ? '⚠️ 外部濕氣入侵中 (絕緣驟降)' : '⚠️ 外部濕氣入侵中 (酸裂解)') 
                                                    : (selectedRack.type === 'immersion_single' ? '⚪ 模擬濕氣入侵' : '⚪ 模擬水氣入侵')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 現有設備清單 */}
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 mb-3 tracking-widest uppercase border-b border-slate-800 pb-1">{t.installedEquipment}</h3>
                            <div className="flex flex-col gap-2">
                                {[...selectedRack.servers].sort((a, b) => b.uPosition - a.uPosition).map((server, idx) => {
                                    let liveStatus = server.status;
                                    const sTel = resolveTelemetryRecordDeep(
                                        telemetry,
                                        server.assetId,
                                        server.name,
                                        selectedRack.name,
                                    );
                                    const metricsText = sTel
                                        ? (server.type === 'switch'
                                            ? `Traffic: ${Number(sTel.traffic_gbps ?? Math.random() * 10).toFixed(1)} Gbps | Ports: ${Math.floor(Number(sTel.port_usage ?? Math.random()) * 48)}/48`
                                            : `CPU: ${Number(sTel.cpu_usage ?? 0).toFixed(1)}% | TEMP: ${Number(sTel.temperature ?? 0).toFixed(1)}°C`)
                                        : "";

                                    return (
                                        <div key={`${selectedRack.id}-${server.id}-${idx}`} className="flex flex-col gap-2 text-xs bg-[#0a1e3f] p-2 rounded border border-slate-700">
                                            {editingServerId === server.id && editingDraft ? (
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={editingDraft.name || ''}
                                                            onChange={(e) => setEditingDraft({ ...editingDraft, name: e.target.value })}
                                                            className="min-w-0 flex-[1_1_10rem] bg-[#0a1e3f] border border-cyan-800 p-1.5 rounded text-white font-bold outline-none focus:border-cyan-400 text-sm"
                                                            placeholder="Server Name"
                                                        />
                                                        <select
                                                            value={editingDraft.model || ""}
                                                            onChange={(e) => setEditingDraft({ ...editingDraft, model: e.target.value })}
                                                            className="min-w-0 flex-[1_1_10rem] bg-[#0a1e3f] border border-cyan-800 p-1.5 rounded text-white outline-none focus:border-cyan-400 text-sm"
                                                        >
                                                            <option value="">Model</option>
                                                            {modelOptionsByType[server.type === "switch" ? "switch" : "server"].map((model) => (
                                                                <option key={model} value={model}>{model}</option>
                                                            ))}
                                                        </select>
                                                        <input
                                                            type="text"
                                                            value={editingDraft.ipAddress || ''}
                                                            onChange={(e) => setEditingDraft({ ...editingDraft, ipAddress: e.target.value })}
                                                            className="min-w-0 flex-[1_1_10rem] bg-[#0a1e3f] border border-cyan-800 p-1.5 rounded text-white outline-none focus:border-cyan-400 text-sm"
                                                            placeholder="Host / IP"
                                                        />
                                                        {server.type === 'switch' && (
                                                            <span className="text-[9px] bg-purple-900 border border-purple-500 px-1 rounded text-purple-100 shrink-0">
                                                                SWITCH
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex gap-2">
                                                        <div className="flex-1">
                                                            <div className="text-slate-500 text-[10px] mb-1">Start U</div>
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                max={selectedRack.uCapacity}
                                                                value={editingDraft.uPosition}
                                                                onChange={(e) => setEditingDraft({ ...editingDraft, uPosition: Number(e.target.value) })}
                                                                className="w-full bg-[#0a1e3f] border border-cyan-800 p-2 rounded text-white outline-none focus:border-cyan-400"
                                                            />
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="text-slate-500 text-[10px] mb-1">Height (U)</div>
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                max={selectedRack.uCapacity}
                                                                value={editingDraft.uHeight}
                                                                onChange={(e) => setEditingDraft({ ...editingDraft, uHeight: Number(e.target.value) })}
                                                                className="w-full bg-[#0a1e3f] border border-cyan-800 p-2 rounded text-white outline-none focus:border-cyan-400"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-2">
                                                        <div className="flex-1">
                                                            <div className="text-slate-500 text-[10px] mb-1">Power (kW)</div>
                                                            <input
                                                                type="number"
                                                                step="0.1"
                                                                value={editingDraft.powerKw}
                                                                onChange={(e) => {
                                                                    const kw = Number(e.target.value);
                                                                    const co2e = parseFloat((kw * 24 * 30 * 0.495 * 1.5).toFixed(1));
                                                                    setEditingDraft({ ...editingDraft, powerKw: kw, carbonEmission: co2e });
                                                                }}
                                                                className="w-full bg-[#0a1e3f] border border-cyan-800 p-2 rounded text-white outline-none focus:border-cyan-400"
                                                            />
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="text-slate-500 text-[10px] mb-1">Type</div>
                                                            <select
                                                                value={editingDraft.type}
                                                                onChange={(e) => setEditingDraft({ ...editingDraft, type: e.target.value as any })}
                                                                className="w-full bg-[#0a1e3f] border border-cyan-800 p-2 rounded text-white outline-none focus:border-cyan-400"
                                                            >
                                                                <option value="server">Server</option>
                                                                <option value="storage">Storage</option>
                                                                <option value="switch">Switch</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-2">
                                                        <div className="flex-1">
                                                            <div className="text-slate-500 text-[10px] mb-1">Status</div>
                                                            <select
                                                                value={editingDraft.status}
                                                                onChange={(e) => setEditingDraft({ ...editingDraft, status: e.target.value as any })}
                                                                className="w-full bg-[#0a1e3f] border border-cyan-800 p-2 rounded text-white outline-none focus:border-cyan-400"
                                                            >
                                                                <option value="normal">normal</option>
                                                                <option value="warning">warning</option>
                                                                <option value="critical">critical</option>
                                                                <option value="offline">offline</option>
                                                            </select>
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="text-slate-500 text-[10px] mb-1">GPU Model</div>
                                                            <select
                                                                value={editingDraft.gpuModel || ""}
                                                                onChange={(e) => {
                                                                    const selectedModel = e.target.value;
                                                                    const autoFlops = GPU_PFLOPS_MAP[selectedModel];
                                                                    setEditingDraft({ 
                                                                        ...editingDraft, 
                                                                        gpuModel: selectedModel,
                                                                        ...(autoFlops !== undefined ? { flops: autoFlops } : {})
                                                                    });
                                                                }}
                                                                className="w-full bg-[#0a1e3f] border border-cyan-800 p-2 rounded text-white outline-none focus:border-cyan-400"
                                                            >
                                                                <option value="">(None)</option>
                                                                <option value="8x NVIDIA GB200 (Blackwell)">8x NVIDIA GB200 (Blackwell)</option>
                                                                <option value="8x NVIDIA HGX H200">8x NVIDIA HGX H200</option>
                                                                <option value="8x NVIDIA HGX H100">8x NVIDIA HGX H100</option>
                                                                <option value="8x NVIDIA HGX A100">8x NVIDIA HGX A100</option>
                                                                <option value="4x NVIDIA L40S">4x NVIDIA L40S</option>
                                                                <option value="8x AMD Instinct MI300X">8x AMD Instinct MI300X</option>
                                                                <option value="8x Intel Gaudi 3">8x Intel Gaudi 3</option>
                                                                {editingDraft.gpuModel && ![
                                                                    "",
                                                                    "8x NVIDIA GB200 (Blackwell)",
                                                                    "8x NVIDIA HGX H200",
                                                                    "8x NVIDIA HGX H100",
                                                                    "8x NVIDIA HGX A100",
                                                                    "4x NVIDIA L40S",
                                                                    "8x AMD Instinct MI300X",
                                                                    "8x Intel Gaudi 3"
                                                                ].includes(editingDraft.gpuModel) && (
                                                                    <option value={editingDraft.gpuModel}>{editingDraft.gpuModel} (Custom)</option>
                                                                )}
                                                            </select>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-2">
                                                        <div className="flex-1">
                                                            <div className="text-slate-500 text-[10px] mb-1">AI Compute (PFLOPS)</div>
                                                            <input
                                                                type="number"
                                                                placeholder="0"
                                                                value={editingDraft.flops ?? ''}
                                                                onChange={(e) => setEditingDraft({ ...editingDraft, flops: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                                                                className="w-full bg-[#0a1e3f] border border-cyan-800 p-2 rounded text-white outline-none focus:border-cyan-400"
                                                            />
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="text-slate-500 text-[10px] mb-1">CO2e (kg/mo)</div>
                                                            <input
                                                                type="number"
                                                                placeholder="0"
                                                                value={editingDraft.carbonEmission ?? ''}
                                                                onChange={(e) => setEditingDraft({ ...editingDraft, carbonEmission: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                                                                className="w-full bg-[#0a1e3f] border border-cyan-800 p-2 rounded text-white outline-none focus:border-cyan-400"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-2 justify-end pt-1">
                                                        <button
                                                            onClick={() => {
                                                                const ok = updateServerInRack(selectedRack.id, server.id, editingDraft);
                                                                if (!ok) {
                                                                    alert("更新失敗：請確認 U 區間是否越界/重疊。");
                                                                    return;
                                                                }
                                                                setEditingServerId(null);
                                                                setEditingDraft(null);
                                                            }}
                                                            className="bg-cyan-700 hover:bg-cyan-500 text-white font-bold tracking-widest py-1.5 px-3 rounded transition flex items-center gap-2"
                                                        >
                                                            <Save size={14} /> Save
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setEditingServerId(null);
                                                                setEditingDraft(null);
                                                            }}
                                                            className="bg-[#0a1e3f] border border-cyan-800 text-cyan-300 hover:bg-[#152e5c] font-bold tracking-widest py-1.5 px-3 rounded transition"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex justify-between items-center gap-2">
                                                    <div>
                                                        <div className={`font-bold flex items-center gap-2 ${liveStatus === 'critical' ? 'text-red-400' : liveStatus === 'warning' ? 'text-yellow-400' : 'text-cyan-100'}`}>
                                                            <div className={`w-2 h-2 rounded-full ${liveStatus === 'critical' ? 'bg-red-500 animate-pulse' : liveStatus === 'warning' ? 'bg-yellow-500' : 'bg-cyan-500'}`}></div>
                                                            {server.name} {server.type === 'switch' && <span className="text-[9px] bg-purple-900 border border-purple-500 px-1 rounded text-purple-100 ml-1">SWITCH</span>}
                                                        </div>
                                                        <div className="text-slate-400 mt-1">
                                                            U{server.uPosition} - U{server.uPosition + server.uHeight - 1} ({server.uHeight}U) | {server.powerKw}kW
                                                        </div>
                                                        {server.ipAddress ? (
                                                            <div className="text-[10px] text-slate-500 mt-1 font-mono break-all">
                                                                Host / IP: {server.ipAddress}
                                                            </div>
                                                        ) : null}
                                                        {server.gpuModel ? (
                                                            <div className="text-[10px] text-emerald-500 mt-1 font-mono tracking-widest flex items-center gap-2">
                                                                <span className="flex items-center gap-1"><Cpu size={10} /> {server.gpuModel}</span>
                                                                {(server.flops !== undefined || server.carbonEmission !== undefined) && (
                                                                    <span className="opacity-70 border-l border-emerald-800 pl-2">
                                                                        {server.flops ?? 0} PFLOPS | {server.carbonEmission ?? 0} kg CO2e
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : null}
                                                        {server.model ? (
                                                            <div className="text-[10px] text-slate-500 mt-1 font-mono break-all">
                                                                Model: {server.model}
                                                            </div>
                                                        ) : null}
                                                        {metricsText && (
                                                            <div className={`mt-1 font-mono text-[10px] ${liveStatus === 'critical' ? 'text-red-300' : liveStatus === 'warning' ? 'text-yellow-300' : (server.type === 'switch' ? 'text-purple-400' : 'text-cyan-700')}`}>
                                                                {metricsText}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {isEditMode && (
                                                            <button
                                                                onClick={() => {
                                                                        setEditingServerId(server.id);
                                                                        setEditingDraft({
                                                                            name: server.name,
                                                                            model: server.model || "",
                                                                            ipAddress: server.ipAddress || "",
                                                                            uPosition: server.uPosition,
                                                                            uHeight: server.uHeight,
                                                                            powerKw: server.powerKw,
                                                                            type: server.type,
                                                                            status: server.status,
                                                                            gpuModel: server.gpuModel,
                                                                            flops: server.flops,
                                                                            carbonEmission: server.carbonEmission,
                                                                        });
                                                                    }}
                                                                className="text-cyan-400 hover:bg-cyan-900/30 p-1 rounded transition"
                                                                title="Edit Server"
                                                            >
                                                                <Edit size={14} />
                                                            </button>
                                                        )}
                                                        {isEditMode && (
                                                            <button
                                                                onClick={() => removeServerFromRack(selectedRack.id, server.id)}
                                                                className="text-red-400 hover:bg-red-900/30 p-1 rounded transition"
                                                                title="Remove Server"
                                                            >
                                                                <Trash size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {selectedRack.servers.length === 0 && (
                                    <div className="text-xs text-slate-600 text-center py-4 border border-dashed border-slate-800 rounded">{t.emptyRack}</div>
                                )}
                            </div>
                        </div>

                        {/* 新增設備表單 */}
                        {isEditMode && <div className="bg-[#010613] p-4 rounded-lg border border-cyan-900/50 mb-10">
                            <h3 className="text-xs font-bold text-cyan-600 mb-3 tracking-widest uppercase">
                                {selectedRack.type === 'network' ? 'Install New Switch/Core' : 'Install New Server'}
                            </h3>
                            <div className="flex flex-col gap-3 text-xs">
                                <input
                                    type="text"
                                    value={newServer.name}
                                    onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                                    className="bg-[#0a1e3f] border border-cyan-800 p-2 rounded text-white outline-none focus:border-cyan-400"
                                    placeholder="Device Name"
                                />
                                <select
                                    value={newServer.model || ""}
                                    onChange={(e) => setNewServer({ ...newServer, model: e.target.value })}
                                    className="bg-[#0a1e3f] border border-cyan-800 p-2 rounded text-white outline-none focus:border-cyan-400"
                                >
                                    <option value="">Model</option>
                                    {modelOptionsByType[newServer.type === "switch" ? "switch" : "server"].map((model) => (
                                        <option key={model} value={model}>{model}</option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    value={newServer.ipAddress}
                                    onChange={(e) => setNewServer({ ...newServer, ipAddress: e.target.value })}
                                    className="bg-[#0a1e3f] border border-cyan-800 p-2 rounded text-white outline-none focus:border-cyan-400"
                                    placeholder="Host / IP"
                                />
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="text-slate-500 mb-1 block">Start U</label>
                                        <input
                                            type="number" min="1" max={selectedRack.uCapacity}
                                            value={newServer.uPosition}
                                            onChange={(e) => setNewServer({ ...newServer, uPosition: Number(e.target.value) })}
                                            className="w-full bg-[#0a1e3f] border border-cyan-800 p-2 rounded text-white outline-none focus:border-cyan-400"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-slate-500 mb-1 block">Height (U)</label>
                                        <input
                                            type="number" min="1" max={selectedRack.uCapacity}
                                            value={newServer.uHeight}
                                            onChange={(e) => setNewServer({ ...newServer, uHeight: Number(e.target.value) })}
                                            className="w-full bg-[#0a1e3f] border border-cyan-800 p-2 rounded text-white outline-none focus:border-cyan-400"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="text-slate-500 mb-1 block">Power (kW)</label>
                                        <input
                                            type="number" step="0.1"
                                            value={newServer.powerKw}
                                            onChange={(e) => {
                                                const kw = Number(e.target.value);
                                                const co2e = parseFloat((kw * 24 * 30 * 0.495 * 1.5).toFixed(1));
                                                setNewServer({ ...newServer, powerKw: kw, carbonEmission: co2e });
                                            }}
                                            className="w-full bg-[#0a1e3f] border border-cyan-800 p-2 rounded text-white outline-none focus:border-cyan-400"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-slate-500 mb-1 block">Type</label>
                                        <select
                                            value={newServer.type}
                                            onChange={(e) => setNewServer({ ...newServer, type: e.target.value as any })}
                                            className="w-full bg-[#0a1e3f] border border-cyan-800 p-2 rounded text-white outline-none focus:border-cyan-400"
                                        >
                                            <option value="server">Server</option>
                                            <option value="storage">Storage</option>
                                            <option value="switch">Switch</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="text-slate-500 mb-1 block">Status</label>
                                        <select
                                            value={newServer.status}
                                            onChange={(e) => setNewServer({ ...newServer, status: e.target.value as any })}
                                            className="w-full bg-[#0a1e3f] border border-cyan-800 p-2 rounded text-white outline-none focus:border-cyan-400"
                                        >
                                            <option value="normal">normal</option>
                                            <option value="warning">warning</option>
                                            <option value="critical">critical</option>
                                            <option value="offline">offline</option>
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-slate-500 mb-1 block">GPU Model</label>
                                        <select
                                            value={newServer.gpuModel || ""}
                                            onChange={(e) => {
                                                const selectedModel = e.target.value;
                                                const autoFlops = GPU_PFLOPS_MAP[selectedModel];
                                                setNewServer({ 
                                                    ...newServer, 
                                                    gpuModel: selectedModel,
                                                    ...(autoFlops !== undefined ? { flops: autoFlops } : {})
                                                });
                                            }}
                                            className="w-full bg-[#0a1e3f] border border-cyan-800 p-2 rounded text-white outline-none focus:border-cyan-400"
                                        >
                                            <option value="">(None)</option>
                                            <option value="8x NVIDIA GB200 (Blackwell)">8x NVIDIA GB200 (Blackwell)</option>
                                            <option value="8x NVIDIA HGX H200">8x NVIDIA HGX H200</option>
                                            <option value="8x NVIDIA HGX H100">8x NVIDIA HGX H100</option>
                                            <option value="8x NVIDIA HGX A100">8x NVIDIA HGX A100</option>
                                            <option value="4x NVIDIA L40S">4x NVIDIA L40S</option>
                                            <option value="8x AMD Instinct MI300X">8x AMD Instinct MI300X</option>
                                            <option value="8x Intel Gaudi 3">8x Intel Gaudi 3</option>
                                            {newServer.gpuModel && ![
                                                "",
                                                "8x NVIDIA GB200 (Blackwell)",
                                                "8x NVIDIA HGX H200",
                                                "8x NVIDIA HGX H100",
                                                "8x NVIDIA HGX A100",
                                                "4x NVIDIA L40S",
                                                "8x AMD Instinct MI300X",
                                                "8x Intel Gaudi 3"
                                            ].includes(newServer.gpuModel) && (
                                                <option value={newServer.gpuModel}>{newServer.gpuModel} (Custom)</option>
                                            )}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="text-slate-500 mb-1 block">AI Compute (PFLOPS)</label>
                                        <input
                                            type="number"
                                            placeholder="0"
                                            value={newServer.flops ?? ''}
                                            onChange={(e) => setNewServer({ ...newServer, flops: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                                            className="w-full bg-[#0a1e3f] border border-cyan-800 p-2 rounded text-white outline-none focus:border-cyan-400"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-slate-500 mb-1 block">CO2e (kg/mo)</label>
                                        <input
                                            type="number"
                                            placeholder="0"
                                            value={newServer.carbonEmission ?? ''}
                                            onChange={(e) => setNewServer({ ...newServer, carbonEmission: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                                            className="w-full bg-[#0a1e3f] border border-cyan-800 p-2 rounded text-white outline-none focus:border-cyan-400"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={handleAddServer}
                                    className="w-full mt-2 bg-cyan-700 hover:bg-cyan-500 text-white font-bold tracking-widest py-2 rounded flex items-center justify-center gap-2 transition"
                                >
                                    <Save size={16} /> {selectedRack.type === 'network' ? 'MOUNT SWITCH' : 'MOUNT DEVICE'}
                                </button>
                            </div>
                        </div>}
                    </div>
                </div>
            )}

            {/* 右側屬性面板 (Equipment) */}
            {selectedEquipment && (
                <div className="w-80 bg-[#020b1a] border-l border-[#1e3a8a] flex flex-col z-10 shadow-[-2px_0_15px_rgba(6,182,212,0.1)]">
                    <div className="p-4 border-b border-[#1e3a8a] flex justify-between items-center bg-gradient-to-r from-transparent to-[#0a1e3f]">
                        <h2 className="text-cyan-400 font-bold tracking-widest uppercase text-xs">{t.equipmentSettings}</h2>
                        {isEditMode && (
                            <button onClick={() => removeEquipment(selectedEquipment.id)} className="text-red-500 hover:text-red-400 transition" title="Delete Equipment">
                                <Trash size={16} />
                            </button>
                        )}
                    </div>
                    <div className="p-4 flex flex-col gap-6">
                        <div className="bg-[#03112b] p-4 rounded-lg border border-slate-800">
                            <label className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-2 block">Display Name</label>
                            <input
                                type="text"
                                value={selectedEquipment.name}
                                onChange={(e) => updateEquipmentName(selectedEquipment.id, e.target.value)}
                                className="w-full bg-[#010613] border border-cyan-900/30 p-2 rounded text-cyan-100 text-sm outline-none focus:border-cyan-400 transition-colors mb-4"
                            />
                            <label className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-2 block">Model</label>
                            <select
                                value={selectedEquipment.model || ""}
                                onChange={(e) => updateEquipmentModel(selectedEquipment.id, e.target.value)}
                                className="w-full bg-[#010613] border border-cyan-900/30 p-2 rounded text-cyan-100 text-sm outline-none focus:border-cyan-400 transition-colors mb-4"
                            >
                                <option value="">(Custom)</option>
                                {modelOptionsByType[commDeviceTypeForEquipment(selectedEquipment.type)].map((model) => (
                                    <option key={model} value={model}>{model}</option>
                                ))}
                            </select>
                            <label className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-2 block">Host / IP</label>
                            <input
                                type="text"
                                value={selectedEquipment.ipAddress || ""}
                                onChange={(e) => updateEquipmentIp(selectedEquipment.id, e.target.value)}
                                placeholder="e.g. 192.168.1.100"
                                className="w-full bg-[#010613] border border-cyan-900/30 p-2 rounded text-cyan-100 text-sm outline-none focus:border-cyan-400 transition-colors mb-4"
                            />
                            <div className="text-xs text-slate-400 mb-1 uppercase tracking-widest">Facility Type</div>
                            <div className="text-cyan-400 font-bold tracking-widest text-lg">
                                {selectedEquipment.type === 'crac' && 'CRAC (Cooling HVAC)'}
                                {selectedEquipment.type === 'pdu' && 'PDU (Power Dist. Unit)'}
                                {selectedEquipment.type === 'cdu' && 'CDU (Liquid Cooling)'}
                                {selectedEquipment.type === 'ups' && 'UPS (Uninterruptible Power)'}
                                {selectedEquipment.type === 'chiller' && 'Chiller (Ice Water)'}
                                {selectedEquipment.type === 'dashboard' && 'Dashboard Center'}
                            </div>

                            {/* 旋轉控制 */}
                            {isEditMode && (
                                <div className="mt-4 border-t border-slate-800/50 pt-3">
                                    <label className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-2 block">Direction Control</label>
                                    <div className="flex gap-2">
                                        <button onClick={() => updateEquipmentRotation(selectedEquipment.id, [0, selectedEquipment.rotation[1] + Math.PI / 2, 0])} className="flex-1 bg-[#0a1e3f] hover:bg-cyan-900 border border-cyan-800 text-cyan-400 p-2 rounded transition text-xs font-bold tracking-widest flex items-center justify-center gap-1">
                                            ↺ 左轉 90°
                                        </button>
                                        <button onClick={() => updateEquipmentRotation(selectedEquipment.id, [0, selectedEquipment.rotation[1] - Math.PI / 2, 0])} className="flex-1 bg-[#0a1e3f] hover:bg-cyan-900 border border-cyan-800 text-cyan-400 p-2 rounded transition text-xs font-bold tracking-widest flex items-center justify-center gap-1">
                                            ↻ 右轉 90°
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {selectedEquipment.type === 'dashboard' && (
                            <div className="flex flex-col gap-4">
                                <div className="bg-[#03112b] p-4 rounded-lg border border-purple-900/40">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Globe size={14} className="text-purple-400" />
                                        <h3 className="text-xs font-bold text-purple-400 tracking-widest uppercase">Network Overview</h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                                        <div className="bg-[#0a1e3f] p-2 rounded">
                                            <div className="text-slate-500 mb-1">Total Switches</div>
                                            <div className="text-purple-300 font-bold text-lg">{racks.flatMap(r => r.servers).filter(s => s.type === 'switch').length}</div>
                                        </div>
                                        <div className="bg-[#0a1e3f] p-2 rounded">
                                            <div className="text-slate-500 mb-1">Total Traffic</div>
                                            <div className="text-purple-300 font-bold text-lg">
                                                {(racks.flatMap(r => r.servers).filter(s => s.type === 'switch').length * 4.2).toFixed(1)} <span className="text-[8px]">Gbps</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 text-[10px] text-purple-400/60 font-mono italic">
                                        Data pushed via Kafka core...
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* CDU: Rack Connection Selector + Live Telemetry */}
                        {selectedEquipment.type === 'cdu' && (() => {
                            const cduTelem = resolveTelemetryRecordDeep(
                                telemetry,
                                selectedEquipment.name,
                                normalizeNodeId(selectedEquipment.name),
                            ) as Record<string, any> | undefined;
                            const serverRacks = racks.filter(r => r.locationId === currentLocationId && (r.type === 'server' || r.type === 'immersion_single'));
                            const connectedIds: string[] = selectedEquipment.connectedRackIds ?? [];

                            const toggleRack = (rackId: string) => {
                                const updated = connectedIds.includes(rackId)
                                    ? connectedIds.filter(id => id !== rackId)
                                    : [...connectedIds, rackId];
updateEquipmentConnectedRacks(selectedEquipment.id, updated);
                            };

                            return (
                                <div className="flex flex-col gap-4">
                                    {/* Rack Selector */}
                                    <div className="bg-[#03112b] p-4 rounded-lg border border-cyan-800">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Thermometer size={14} className="text-cyan-400" />
                                            <h3 className="text-xs font-bold text-cyan-400 tracking-widest uppercase">連接機架 (Coolant Pipe)</h3>
                                        </div>
                                        <p className="text-[10px] text-slate-500 mb-3">勾選後粒子流將從此 CDU 延伸至指定機架。若無勾選，自動連接最近 3 台。</p>
                                        <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                                            {serverRacks.length === 0 && (
                                                <p className="text-slate-600 text-xs">場景中無伺服器機架</p>
                                            )}
                                            {serverRacks.map(rack => (
                                                <label key={rack.id} className="flex items-center gap-2 cursor-pointer group">
                                                    <input
                                                        type="checkbox"
                                                        checked={connectedIds.includes(rack.id)}
                                                        onChange={() => toggleRack(rack.id)}
                                                        className="accent-cyan-400"
                                                    />
                                                    <span className={`text-xs font-mono transition ${connectedIds.includes(rack.id) ? 'text-cyan-300' : 'text-slate-400 group-hover:text-slate-200'}`}>
                                                        {rack.name}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                        {connectedIds.length > 0 && (
                                            <button
                                                onClick={() => updateEquipmentConnectedRacks(selectedEquipment.id, [])}
                                                className="mt-3 text-[10px] text-slate-500 hover:text-red-400 transition underline"
                                            >
                                                清除 → 恢復自動模式
                                            </button>
                                        )}
                                    </div>

                                    {/* Live Liquid Cooling Telemetry */}
                                    <div className="bg-[#03112b] p-4 rounded-lg border border-blue-900/50">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Zap size={14} className="text-blue-400" />
                                            <h3 className="text-xs font-bold text-blue-400 tracking-widest uppercase">液冷即時數據</h3>
                                        </div>
                                        {!cduTelem ? (
                                            <p className="text-slate-600 text-xs">尚未接收到 {selectedEquipment.name} 的遙測數據。請確認 CDU Agent 已啟動。</p>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                                                {[
                                                    { label: '進水 Supply', value: cduTelem.inlet_temp !== undefined ? `${cduTelem.inlet_temp}°C` : '---', color: 'text-sky-400' },
                                                    { label: '回水 Return', value: cduTelem.outlet_temp !== undefined ? `${cduTelem.outlet_temp}°C` : '---', color: cduTelem.outlet_temp > 45 ? 'text-red-400' : 'text-orange-400' },
                                                    { label: '流量 Flow', value: cduTelem.flow_rate_lpm !== undefined ? `${cduTelem.flow_rate_lpm} LPM` : '---', color: cduTelem.flow_rate_lpm < 5 ? 'text-red-400' : 'text-cyan-400' },
                                                    { label: '壓力 Pressure', value: cduTelem.pressure_bar !== undefined ? `${cduTelem.pressure_bar} bar` : '---', color: 'text-violet-400' },
                                                    { label: '幫浦 A', value: cduTelem.pump_a_rpm !== undefined ? `${cduTelem.pump_a_rpm} RPM` : '---', color: 'text-emerald-400' },
                                                    { label: '幫浦 B', value: cduTelem.pump_b_rpm !== undefined ? `${cduTelem.pump_b_rpm} RPM` : '---', color: 'text-emerald-400' },
                                                    { label: '液位 Tank', value: cduTelem.reservoir_level !== undefined ? `${cduTelem.reservoir_level}%` : '---', color: cduTelem.reservoir_level < 30 ? 'text-red-400' : 'text-slate-300' },
                                                    { label: '閥門 Valve', value: cduTelem.valve_position !== undefined ? `${cduTelem.valve_position}%` : '---', color: 'text-slate-300' },
                                                    { label: '冰水進 CHW↓', value: cduTelem.facility_supply_temp !== undefined ? `${cduTelem.facility_supply_temp}°C` : '---', color: 'text-sky-300' },
                                                    { label: '冰水回 CHW↑', value: cduTelem.facility_return_temp !== undefined ? `${cduTelem.facility_return_temp}°C` : '---', color: 'text-sky-300' },
                                                ].map(row => (
                                                    <div key={row.label} className="flex justify-between gap-1">
                                                        <span className="text-slate-500">{row.label}</span>
                                                        <span className={`font-mono font-bold ${row.color}`}>{row.value}</span>
                                                    </div>
                                                ))}
                                                {cduTelem.leak_detected === true && (
                                                    <div className="col-span-2 mt-1 text-center bg-red-900/40 border border-red-600 rounded p-1 text-red-400 font-bold animate-pulse">
                                                        ⚠ LEAK DETECTED
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}

                        <div className="bg-[#03112b] p-4 rounded-lg border border-slate-800 text-xs text-slate-500 font-mono flex flex-col gap-1">
                            <p>X Position: {Math.round(selectedEquipment.position[0] * 100) / 100}m</p>
                            <p>Z Position: {Math.round(selectedEquipment.position[2] * 100) / 100}m</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
