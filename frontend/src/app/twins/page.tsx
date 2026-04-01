"use client";
import React, { useRef, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useDcimStore, ServerData } from "@/store/useDcimStore";
import RoomContext from "@/components/3d/RoomContext";
import RackModel from "@/components/3d/RackModel";
import EquipmentModel from "@/components/3d/EquipmentModel";
import NetworkLines from "@/components/3d/NetworkLines";
import CoolantFlow from "@/components/3d/CoolantFlow";
import { apiUrl } from "@/shared/api";
import { Activity, Download, Upload, Server, Trash, Save, Edit, Lock, Thermometer, Zap, Box, MonitorIcon, Globe, Link2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { useLanguage } from "@/shared/i18n/language";
import { usePolling } from "@/shared/hooks/usePolling";

export default function TwinsPage() {
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
        };
    const store = useDcimStore();
    const selectedRack = store.racks.find((r) => r.id === store.selectedRackId && r.locationId === store.currentLocationId);
    const selectedEquipment = store.equipments.find((e) => e.id === store.selectedEquipmentId && e.locationId === store.currentLocationId);
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
        const allNames = store.racks.flatMap(r => r.servers.map(s => s.name));
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
    }, [store.selectedRackId]);

    usePolling(async () => {
        try {
            const res = await fetch(apiUrl("/metrics"), { cache: "no-store" });
            if (!res.ok) return;
            const json = await res.json();
            const tMap: Record<string, any> = {};
            (json.data || []).forEach((d: any) => {
                tMap[d.server_id] = d;
            });
            setTelemetry(tMap);
        } catch (e) { }
    }, { intervalMs: 5000, immediate: true });

    const handleExport = () => {
        const json = store.exportState();
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
            if (store.importState(content)) {
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
        const allServers = store.racks.flatMap(r => r.servers);
        if (allServers.some(s => s.name === newServer.name)) {
            alert(`❌ 無法新增！伺服器名稱 ${newServer.name} 已經存在於其他機櫃中，名稱不可重複！`);
            return;
        }

        const success = store.addServerToRack(selectedRack.id, newServer);
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

                {store.isEditMode && (
                    <div className="flex flex-col gap-3 mt-2 pt-4 border-t border-cyan-900/50 w-full items-center">
                        <button onClick={() => store.addRack([Math.floor(Math.random() * 5), 0, Math.floor(Math.random() * 5)])} className="p-3 bg-[#020b1a] rounded-xl text-indigo-400 hover:text-indigo-300 hover:bg-[#0a1e3f] transition" title="Add RACK">
                            <Server size={24} />
                        </button>
                        <button onClick={() => store.addEquipment('crac', [Math.floor(Math.random() * 5), 0, Math.floor(Math.random() * 5)])} className="p-3 bg-[#020b1a] rounded-xl text-teal-400 hover:text-teal-300 hover:bg-[#0a1e3f] transition" title="Add CRAC (Cooling)">
                            <Thermometer size={24} />
                        </button>
                        <button onClick={() => store.addEquipment('pdu', [Math.floor(Math.random() * 5), 0, Math.floor(Math.random() * 5)])} className="p-3 bg-[#020b1a] rounded-xl text-orange-400 hover:text-orange-300 hover:bg-[#0a1e3f] transition" title="Add PDU (Power)">
                            <Zap size={24} />
                        </button>
                        <button onClick={() => store.addEquipment('cdu', [Math.floor(Math.random() * 5), 0, Math.floor(Math.random() * 5)])} className="p-3 bg-[#020b1a] rounded-xl text-cyan-300 hover:text-cyan-200 hover:bg-[#0a1e3f] transition" title="Add CDU (Liquid Cooling)">
                            <Box size={24} />
                        </button>
                        <button onClick={() => store.addEquipment('ups', [Math.floor(Math.random() * 5), 0, Math.floor(Math.random() * 5)])} className="p-3 bg-[#020b1a] rounded-xl text-yellow-500 hover:text-yellow-400 hover:bg-[#0a1e3f] transition" title="Add UPS (Power Backup)">
                            <Zap size={24} />
                        </button>
                        <button onClick={() => store.addEquipment('chiller', [Math.floor(Math.random() * 5), 0, Math.floor(Math.random() * 5)])} className="p-3 bg-[#020b1a] rounded-xl text-blue-500 hover:text-blue-400 hover:bg-[#0a1e3f] transition" title="Add Chiller (Water Cooling)">
                            <Activity size={24} />
                        </button>
                        <button onClick={() => store.addEquipment('dashboard', [Math.floor(Math.random() * 5), 0, Math.floor(Math.random() * 5)])} className="p-3 bg-[#020b1a] rounded-xl text-emerald-500 hover:text-emerald-400 hover:bg-[#0a1e3f] transition" title="Add Dashboard PC">
                            <MonitorIcon size={24} />
                        </button>
                        <button onClick={() => store.addRack([Math.floor(Math.random() * 5), 0, Math.floor(Math.random() * 5)], 'network')} className="p-3 bg-[#020b1a] rounded-xl text-purple-500 hover:text-purple-400 hover:bg-[#0a1e3f] transition" title="Add Network Rack (Switch)">
                            <Globe size={24} />
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
                    <h1 className="text-2xl font-black italic tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] flex items-center gap-3">
                        <Server /> {t.title}
                        <span className="text-white/20 mx-2 text-sm">|</span>
                        <span className="text-cyan-200 text-lg not-italic tracking-normal">
                            {store.locations.find(l => l.id === store.currentLocationId)?.name || t.unknownSite}
                        </span>
                    </h1>
                    <p className="text-xs text-cyan-700 font-mono mt-1 uppercase">
                        {t.realtime} • {store.locations.find(l => l.id === store.currentLocationId)?.type === 'region' ? t.regionView : t.floorView}
                    </p>
                </div>

                {/* Edit Mode HUD */}
                <div className="absolute top-4 right-4 z-10 flex gap-4">
                    <button
                        onClick={() => store.setEditMode(!store.isEditMode)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold tracking-widest transition-all border ${store.isEditMode ? 'bg-cyan-600 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.5)]' : 'bg-[#0a1e3f]/80 border-[#1e3a8a] text-slate-400 hover:text-white'}`}
                    >
                        {store.isEditMode ? <Edit size={16} /> : <Lock size={16} />}
                        {store.isEditMode ? t.editMode : t.viewOnly}
                    </button>
                </div>

                <Canvas
                    camera={{ position: [5, 4, 8], fov: 45 }}
                    className="w-full h-full outline-none"
                    onPointerMissed={() => {
                        store.selectRack(null);
                        store.selectEquipment(null);
                    }}
                >
                    <RoomContext />
                    {store.racks.filter(r => r.locationId === store.currentLocationId).map((rack) => (
                        <RackModel key={rack.id} data={rack} isSelected={rack.id === store.selectedRackId} telemetry={telemetry} />
                    ))}
                    {store.equipments.filter(e => e.locationId === store.currentLocationId).map((eq) => (
                        <EquipmentModel key={eq.id} data={eq} telemetry={telemetry} />
                    ))}
                    <NetworkLines />
                    {/* Coolant flow particle streams: CDU ↔ Server Racks */}
                    {store.equipments
                        .filter(eq => eq.locationId === store.currentLocationId && eq.type === 'cdu')
                        .flatMap(cdu => {
                            const cduPos: [number, number, number] = [cdu.position[0], 0, cdu.position[2]];
                            const cduTelem = (telemetry as any)[cdu.name];
                            const flowRate = cduTelem?.flow_rate_lpm ?? 8.0;

                            // Use manually configured racks if set, else auto-find 3 nearest
                            const allServerRacks = store.racks.filter(r => r.locationId === store.currentLocationId && r.type === 'server');
                            const targetRacks = cdu.connectedRackIds && cdu.connectedRackIds.length > 0
                                ? allServerRacks.filter(r => cdu.connectedRackIds!.includes(r.id))
                                : allServerRacks
                                    .map(r => ({ rack: r, dist: Math.hypot(r.position[0] - cdu.position[0], r.position[2] - cdu.position[2]) }))
                                    .sort((a, b) => a.dist - b.dist)
                                    .slice(0, 3)
                                    .map(x => x.rack);

                            return targetRacks.flatMap(rack => {
                                const rackPos: [number, number, number] = [rack.position[0], 0, rack.position[2]];
                                return [
                                    <CoolantFlow key={`supply-${cdu.id}-${rack.id}`} from={cduPos} to={rackPos} type="supply" flowRate={flowRate} />,
                                    <CoolantFlow key={`return-${rack.id}-${cdu.id}`} from={rackPos} to={cduPos} type="return" flowRate={flowRate} />,
                                ];
                            });
                        })
                    }
                    <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2 - 0.05} />
                </Canvas>
            </div>

            {/* 右側屬性面板 (Room) */}
            {store.isEditMode && !selectedRack && !selectedEquipment && (
                <div className="w-80 bg-[#020b1a] border-l border-[#1e3a8a] flex flex-col z-10 shadow-[-2px_0_15px_rgba(6,182,212,0.1)]">
                    <div className="p-4 border-b border-[#1e3a8a] flex justify-between items-center bg-gradient-to-r from-transparent to-[#0a1e3f]">
                        <h2 className="text-cyan-400 font-bold tracking-widest uppercase text-xs">Room Settings</h2>
                    </div>
                    <div className="p-4 flex flex-col gap-6 overflow-y-auto flex-1">
                        <div className="bg-[#03112b] p-4 rounded-lg border border-slate-800">
                            <label className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-2 block">Room Name</label>
                            <input
                                type="text"
                                value={store.locations.find(l => l.id === store.currentLocationId)?.name || ''}
                                onChange={(e) => store.updateLocationName(store.currentLocationId, e.target.value)}
                                className="w-full bg-[#010613] border border-cyan-900/30 p-2 rounded text-cyan-100 text-sm outline-none focus:border-cyan-400 transition-colors mb-4"
                            />
                            
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-2 block font-bold text-blue-400">West Wall (-X)</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number" step="0.6"
                                                value={store.locations.find(l => l.id === store.currentLocationId)?.xMin ?? -10}
                                                onChange={(e) => store.updateLocationProps(store.currentLocationId, { xMin: Number(e.target.value) })}
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
                                                value={store.locations.find(l => l.id === store.currentLocationId)?.xMax ?? 10}
                                                onChange={(e) => store.updateLocationProps(store.currentLocationId, { xMax: Number(e.target.value) })}
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
                                                value={store.locations.find(l => l.id === store.currentLocationId)?.zMin ?? -7.5}
                                                onChange={(e) => store.updateLocationProps(store.currentLocationId, { zMin: Number(e.target.value) })}
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
                                                value={store.locations.find(l => l.id === store.currentLocationId)?.zMax ?? 7.5}
                                                onChange={(e) => store.updateLocationProps(store.currentLocationId, { zMax: Number(e.target.value) })}
                                                className="w-full bg-[#010613] border border-cyan-900/30 p-2 rounded text-cyan-100 text-sm outline-none focus:border-cyan-400 transition-colors"
                                            />
                                            <span className="text-[10px] text-slate-600">m</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <label className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-2 block">Door Position</label>
                            <select
                                value={store.locations.find(l => l.id === store.currentLocationId)?.doorPosition || 'right'}
                                onChange={(e) => store.updateLocationProps(store.currentLocationId, { doorPosition: e.target.value as any })}
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
                                    if (store.locations.length <= 1) {
                                        alert("❌ 無法刪除！必須至少保留一個機房！");
                                        return;
                                    }
                                    const pwd = window.prompt("⚠️ 警告：這將會永久刪除此機房與內含的所有設備！\\n請輸入管理員密碼(admin)以確認：");
                                    if (pwd === "admin") {
                                        store.removeLocation(store.currentLocationId);
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
                        <button onClick={() => store.removeRack(selectedRack.id)} className="text-red-500 hover:text-red-400 transition" title="Delete Rack">
                            <Trash size={16} />
                        </button>
                    </div>

                    <div className="p-4 flex flex-col gap-6 overflow-y-auto flex-1">
                        {/* 基本資訊 */}
                        <div className="bg-[#03112b] p-4 rounded-lg border border-slate-800">
                            <label className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-2 block">Rack Name</label>
                            <input
                                type="text"
                                value={selectedRack.name}
                                onChange={(e) => store.updateRackName(selectedRack.id, e.target.value)}
                                className="w-full bg-[#010613] border border-cyan-900/30 p-2 rounded text-cyan-100 text-sm outline-none focus:border-cyan-400 transition-colors"
                            />

                            {/* 旋轉控制 */}
                            {store.isEditMode && (
                                <div className="mt-4 border-t border-slate-800/50 pt-3">
                                    <label className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-2 block">Direction Control</label>
                                    <div className="flex gap-2">
                                        <button onClick={() => store.updateRackRotation(selectedRack.id, [0, selectedRack.rotation[1] + Math.PI / 2, 0])} className="flex-1 bg-[#0a1e3f] hover:bg-cyan-900 border border-cyan-800 text-cyan-400 p-2 rounded transition text-xs font-bold tracking-widest flex items-center justify-center gap-1">
                                            ↺ 左轉 90°
                                        </button>
                                        <button onClick={() => store.updateRackRotation(selectedRack.id, [0, selectedRack.rotation[1] - Math.PI / 2, 0])} className="flex-1 bg-[#0a1e3f] hover:bg-cyan-900 border border-cyan-800 text-cyan-400 p-2 rounded transition text-xs font-bold tracking-widest flex items-center justify-center gap-1">
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
                        {selectedRack.type === 'server' && (
                            <div className="bg-[#03112b] p-4 rounded-lg border border-purple-900/30">
                                <div className="flex items-center gap-2 mb-3">
                                    <Link2 size={14} className="text-purple-400" />
                                    <h3 className="text-xs font-bold text-purple-400 tracking-widest uppercase">Network Uplink</h3>
                                </div>
                                <select
                                    className="w-full bg-[#0a1e3f] border border-purple-800 p-2 rounded text-white text-[11px] outline-none mb-3"
                                    value={selectedRack.connectedNetworkRackId || ""}
                                    onChange={(e) => store.updateRackConnection(selectedRack.id, e.target.value)}
                                >
                                    <option value="">Auto-Hub (Default)</option>
                                    {store.racks.filter(r => r.type === 'network').map(netRack => (
                                        <option key={netRack.id} value={netRack.id}>{netRack.name}</option>
                                    ))}
                                </select>

                                {selectedRack.connectedNetworkRackId && (
                                    <div className="mt-2 border-t border-purple-900/30 pt-3">
                                        <label className="text-[10px] text-purple-400/60 uppercase tracking-[0.15em] mb-1.5 block">Select Destination Switch</label>
                                        <select
                                            className="w-full bg-[#0a1e3f] border border-purple-800 p-2 rounded text-white text-[11px] outline-none"
                                            value={selectedRack.connectedSwitchId || ""}
                                            onChange={(e) => store.updateRackConnection(selectedRack.id, selectedRack.connectedNetworkRackId || null, e.target.value)}
                                        >
                                            <option value="">Automatic (Top-most)</option>
                                            {(store.racks.find(r => r.id === selectedRack.connectedNetworkRackId)?.servers || [])
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
                                {[...selectedRack.servers].sort((a, b) => b.uPosition - a.uPosition).map(server => {
                                    let liveStatus = server.status;
                                    const sTel = telemetry[server.name];
                                    const metricsText = sTel
                                        ? (server.type === 'switch'
                                            ? `Traffic: ${(sTel.traffic_gbps || (Math.random() * 10)).toFixed(1)} Gbps | Ports: ${Math.floor((sTel.port_usage || Math.random()) * 48)}/48`
                                            : `CPU: ${sTel.cpu_usage.toFixed(1)}% | TEMP: ${sTel.temperature.toFixed(1)}°C`)
                                        : "";

                                    return (
                                        <div key={server.id} className="flex flex-col gap-2 text-xs bg-[#0a1e3f] p-2 rounded border border-slate-700">
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
                                                                const ok = store.updateServerInRack(selectedRack.id, server.id, editingDraft);
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
                                                        {store.isEditMode && (
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
                                                        <button
                                                            onClick={() => store.removeServerFromRack(selectedRack.id, server.id)}
                                                            className="text-red-400 hover:bg-red-900/30 p-1 rounded transition"
                                                            title="Remove Server"
                                                        >
                                                            <Trash size={14} />
                                                        </button>
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
                        <div className="bg-[#010613] p-4 rounded-lg border border-cyan-900/50 mb-10">
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
                                            type="number" min="1" max="42"
                                            value={newServer.uPosition}
                                            onChange={(e) => setNewServer({ ...newServer, uPosition: Number(e.target.value) })}
                                            className="w-full bg-[#0a1e3f] border border-cyan-800 p-2 rounded text-white outline-none focus:border-cyan-400"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-slate-500 mb-1 block">Height (U)</label>
                                        <input
                                            type="number" min="1" max="42"
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
                        </div>
                    </div>
                </div>
            )}

            {/* 右側屬性面板 (Equipment) */}
            {selectedEquipment && (
                <div className="w-80 bg-[#020b1a] border-l border-[#1e3a8a] flex flex-col z-10 shadow-[-2px_0_15px_rgba(6,182,212,0.1)]">
                    <div className="p-4 border-b border-[#1e3a8a] flex justify-between items-center bg-gradient-to-r from-transparent to-[#0a1e3f]">
                        <h2 className="text-cyan-400 font-bold tracking-widest uppercase text-xs">{t.equipmentSettings}</h2>
                        {store.isEditMode && (
                            <button onClick={() => store.removeEquipment(selectedEquipment.id)} className="text-red-500 hover:text-red-400 transition" title="Delete Equipment">
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
                                onChange={(e) => store.updateEquipmentName(selectedEquipment.id, e.target.value)}
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
                            {store.isEditMode && (
                                <div className="mt-4 border-t border-slate-800/50 pt-3">
                                    <label className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-2 block">Direction Control</label>
                                    <div className="flex gap-2">
                                        <button onClick={() => store.updateEquipmentRotation(selectedEquipment.id, [0, selectedEquipment.rotation[1] + Math.PI / 2, 0])} className="flex-1 bg-[#0a1e3f] hover:bg-cyan-900 border border-cyan-800 text-cyan-400 p-2 rounded transition text-xs font-bold tracking-widest flex items-center justify-center gap-1">
                                            ↺ 左轉 90°
                                        </button>
                                        <button onClick={() => store.updateEquipmentRotation(selectedEquipment.id, [0, selectedEquipment.rotation[1] - Math.PI / 2, 0])} className="flex-1 bg-[#0a1e3f] hover:bg-cyan-900 border border-cyan-800 text-cyan-400 p-2 rounded transition text-xs font-bold tracking-widest flex items-center justify-center gap-1">
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
                                        onChange={(e) => store.updateEquipmentIp(selectedEquipment.id, e.target.value)}
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
                                            <div className="text-purple-300 font-bold text-lg">{store.racks.flatMap(r => r.servers).filter(s => s.type === 'switch').length}</div>
                                        </div>
                                        <div className="bg-[#0a1e3f] p-2 rounded">
                                            <div className="text-slate-500 mb-1">Total Traffic</div>
                                            <div className="text-purple-300 font-bold text-lg">
                                                {(store.racks.flatMap(r => r.servers).filter(s => s.type === 'switch').length * 4.2).toFixed(1)} <span className="text-[8px]">Gbps</span>
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
                            const serverRacks = store.racks.filter(r => r.locationId === store.currentLocationId && r.type === 'server');
                            const connectedIds: string[] = selectedEquipment.connectedRackIds ?? [];

                            const toggleRack = (rackId: string) => {
                                const updated = connectedIds.includes(rackId)
                                    ? connectedIds.filter(id => id !== rackId)
                                    : [...connectedIds, rackId];
                                store.updateEquipmentConnectedRacks(selectedEquipment.id, updated);
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
                                                onClick={() => store.updateEquipmentConnectedRacks(selectedEquipment.id, [])}
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
