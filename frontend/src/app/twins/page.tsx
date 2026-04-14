"use client";
import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { useDcimStore, ServerData } from "@/store/useDcimStore";
import { apiUrl } from "@/shared/api";
import { normalizeNodeId, buildTelemetryKeys } from "@/shared/nodeId";
import dynamic from "next/dynamic";
import { Activity, Download, Upload, Server, Trash, Save, Edit, Lock, Thermometer, Zap, Box, MonitorIcon, Globe, Link2, Droplets } from "lucide-react";

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
        updateRackRotation,
        updateRackConnection,
        removeServerFromRack,
        updateServerInRack,
        updateLocationName,
        updateLocationProps,
        removeLocation,
        removeEquipment,
        updateEquipmentName,
        updateEquipmentRotation,
        updateEquipmentIp,
        updateEquipmentConnectedRacks,
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
            updateRackRotation: s.updateRackRotation,
            updateRackConnection: s.updateRackConnection,
            removeServerFromRack: s.removeServerFromRack,
            updateServerInRack: s.updateServerInRack,
            updateLocationName: s.updateLocationName,
            updateLocationProps: s.updateLocationProps,
            removeLocation: s.removeLocation,
            removeEquipment: s.removeEquipment,
            updateEquipmentName: s.updateEquipmentName,
            updateEquipmentRotation: s.updateEquipmentRotation,
            updateEquipmentIp: s.updateEquipmentIp,
            updateEquipmentConnectedRacks: s.updateEquipmentConnectedRacks,
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
        uPosition: number;
        uHeight: number;
        powerKw: number;
        type: 'server' | 'switch' | 'storage';
        status: 'normal' | 'warning' | 'critical' | 'offline';
    }>({
        name: "SERVER-001",
        uPosition: 1,
        uHeight: 2,
        powerKw: 1.5,
        type: "server",
        status: "normal",
    });

    const [telemetry, setTelemetry] = useState<Record<string, any>>({});
    /** 網路線與 CDU 管路預設不顯示，由 HUD 按鈕切換 */
    const [showConnectionLines, setShowConnectionLines] = useState(false);

    const [editingServerId, setEditingServerId] = useState<string | null>(null);
    const [editingDraft, setEditingDraft] = useState<{
        uPosition: number;
        uHeight: number;
        powerKw: number;
        type: 'server' | 'switch' | 'storage';
        status: 'normal' | 'warning' | 'critical' | 'offline';
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

    usePolling(async () => {
        try {
            const res = await fetch(apiUrl("/metrics"), { cache: "no-store" });
            if (!res.ok) return;
            const json = await res.json();
            const tMap: Record<string, any> = {};
            (json.data || []).forEach((d: any) => {
                buildTelemetryKeys(d).forEach((key) => {
                    tMap[key] = d;
                });
            });
            setTelemetry(tMap);
        } catch (e) { }
    }, { intervalMs: 5000, immediate: true });

    useEffect(() => {
        const syncTargets = async () => {
            try {
                const modeRes = await fetch(apiUrl("/api/system/mode"), { cache: "no-store" });
                if (!modeRes.ok) return;
                const modeJson = await modeRes.json();
                if (modeJson.mode !== "simulation") return;

                const servers = racks
                    .filter((r) => r.locationId === currentLocationId)
                    .flatMap((r) => r.servers);
                const targets = Array.from(new Set([
                    ...servers.map((s) => normalizeNodeId(s.assetId || s.name)),
                    ...equipments
                        .filter((e) => e.locationId === currentLocationId)
                        .map((e) => normalizeNodeId(e.name)),
                ]));
                if (targets.length === 0) return;

                const bindingItems = servers.map((s) => ({
                    asset_id: normalizeNodeId(s.assetId || s.name),
                    display_name: normalizeNodeId(s.name),
                }));
                if (bindingItems.length > 0) {
                    await fetch(apiUrl("/api/system/id_bindings/bulk_bind"), {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ items: bindingItems }),
                    });
                }

                await fetch(apiUrl("/api/system/simulate_targets"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ targets }),
                });
            } catch {
                // best effort only
            }
        };
        syncTargets();
    }, [racks, equipments, currentLocationId]);

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
                    telemetry={telemetry}
                    showConnectionLines={showConnectionLines}
                    onPointerMissed={clearSceneSelection}
                />
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
                <div className="w-80 bg-[#020b1a] border-l border-[#1e3a8a] flex flex-col z-10 shadow-[-2px_0_15px_rgba(6,182,212,0.1)]">
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

                        {/* 現有設備清單 */}
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 mb-3 tracking-widest uppercase border-b border-slate-800 pb-1">{t.installedEquipment}</h3>
                            <div className="flex flex-col gap-2">
                                {[...selectedRack.servers].sort((a, b) => b.uPosition - a.uPosition).map((server, idx) => {
                                    let liveStatus = server.status;
                                    const sTel =
                                        telemetry[server.assetId || ""] ||
                                        telemetry[normalizeNodeId(server.assetId || "")] ||
                                        telemetry[server.name] ||
                                        telemetry[normalizeNodeId(server.name)] ||
                                        telemetry[selectedRack.name] ||
                                        telemetry[normalizeNodeId(selectedRack.name)];
                                    const metricsText = sTel
                                        ? (server.type === 'switch'
                                            ? `Traffic: ${(sTel.traffic_gbps || (Math.random() * 10)).toFixed(1)} Gbps | Ports: ${Math.floor((sTel.port_usage || Math.random()) * 48)}/48`
                                            : `CPU: ${sTel.cpu_usage.toFixed(1)}% | TEMP: ${sTel.temperature.toFixed(1)}°C`)
                                        : "";

                                    return (
                                        <div key={`${selectedRack.id}-${server.id}-${idx}`} className="flex flex-col gap-2 text-xs bg-[#0a1e3f] p-2 rounded border border-slate-700">
                                            {editingServerId === server.id && editingDraft ? (
                                                <div className="flex flex-col gap-2">
                                                    <div className="text-slate-200 font-bold">
                                                        {server.name}
                                                        {server.type === 'switch' && (
                                                            <span className="text-[9px] bg-purple-900 border border-purple-500 px-1 rounded text-purple-100 ml-1">
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
                                                                onChange={(e) => setEditingDraft({ ...editingDraft, powerKw: Number(e.target.value) })}
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
                                                                        uPosition: server.uPosition,
                                                                        uHeight: server.uHeight,
                                                                        powerKw: server.powerKw,
                                                                        type: server.type,
                                                                        status: server.status,
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
                                            onChange={(e) => setNewServer({ ...newServer, powerKw: Number(e.target.value) })}
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
                                <div className="bg-[#03112b] p-4 rounded-lg border border-cyan-800">
                                    <label className="text-[10px] text-cyan-700 uppercase tracking-[0.2em] mb-2 block">Management IP</label>
                                    <input
                                        type="text"
                                        value={selectedEquipment.ipAddress || ""}
                                        onChange={(e) => updateEquipmentIp(selectedEquipment.id, e.target.value)}
                                        placeholder="e.g. 192.168.1.100"
                                        className="w-full bg-[#010613] border border-cyan-900 p-2 rounded text-cyan-100 text-xs outline-none focus:border-cyan-400 transition-colors"
                                    />
                                </div>

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
                            const cduTelem = (telemetry as any)[selectedEquipment.name];
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
