"use client";
import React, { useRef, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useDcimStore, ServerData } from "@/store/useDcimStore";
import RoomContext from "@/components/3d/RoomContext";
import RackModel from "@/components/3d/RackModel";
import EquipmentModel from "@/components/3d/EquipmentModel";
import NetworkLines from "@/components/3d/NetworkLines";
import { Activity, Download, Upload, Server, Trash, Save, Edit, Lock, Thermometer, Zap, Box, MonitorIcon, Globe, Link2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

export default function TwinsPage() {
    const store = useDcimStore();
    const selectedRack = store.racks.find((r) => r.id === store.selectedRackId);
    const selectedEquipment = store.equipments.find((e) => e.id === store.selectedEquipmentId);
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

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch("http://localhost:8000/metrics", { cache: "no-store" });
                if (!res.ok) return;
                const json = await res.json();
                const tMap: Record<string, any> = {};
                (json.data || []).forEach((d: any) => {
                    tMap[d.server_id] = d;
                });
                setTelemetry(tMap);
            } catch (e) { }
        };
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    if (typeof console !== 'undefined') {
        const originalWarn = console.warn;
        console.warn = (...args) => {
            if (typeof args[0] === 'string') {
                if (args[0].includes('THREE.Clock') || args[0].includes('THREE.WebGLRenderer')) return;
            }
            originalWarn(...args);
        };
    }
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
                        <button onClick={() => store.addRack([Math.floor(Math.random() * 5), 0, Math.floor(Math.random() * 5)])} className="p-3 bg-[#020b1a] rounded-xl text-slate-400 hover:text-cyan-400 hover:bg-[#0a1e3f] transition" title="Add RACK">
                            <Server size={24} />
                        </button>
                        <button onClick={() => store.addEquipment('crac', [Math.floor(Math.random() * 5), 0, Math.floor(Math.random() * 5)])} className="p-3 bg-[#020b1a] rounded-xl text-slate-400 hover:text-cyan-400 hover:bg-[#0a1e3f] transition" title="Add CRAC (Cooling)">
                            <Thermometer size={24} />
                        </button>
                        <button onClick={() => store.addEquipment('pdu', [Math.floor(Math.random() * 5), 0, Math.floor(Math.random() * 5)])} className="p-3 bg-[#020b1a] rounded-xl text-slate-400 hover:text-cyan-400 hover:bg-[#0a1e3f] transition" title="Add PDU (Power)">
                            <Zap size={24} />
                        </button>
                        <button onClick={() => store.addEquipment('cdu', [Math.floor(Math.random() * 5), 0, Math.floor(Math.random() * 5)])} className="p-3 bg-[#020b1a] rounded-xl text-slate-400 hover:text-cyan-400 hover:bg-[#0a1e3f] transition" title="Add CDU (Liquid Cooling)">
                            <Box size={24} />
                        </button>
                        <button onClick={() => store.addEquipment('ups', [Math.floor(Math.random() * 5), 0, Math.floor(Math.random() * 5)])} className="p-3 bg-[#020b1a] rounded-xl text-slate-400 hover:text-cyan-400 hover:bg-[#0a1e3f] transition" title="Add UPS (Power Backup)">
                            <Zap size={24} className="text-yellow-500" />
                        </button>
                        <button onClick={() => store.addEquipment('chiller', [Math.floor(Math.random() * 5), 0, Math.floor(Math.random() * 5)])} className="p-3 bg-[#020b1a] rounded-xl text-slate-400 hover:text-cyan-400 hover:bg-[#0a1e3f] transition" title="Add Chiller (Water Cooling)">
                            <Activity size={24} className="text-blue-500" />
                        </button>
                        <button onClick={() => store.addEquipment('dashboard', [Math.floor(Math.random() * 5), 0, Math.floor(Math.random() * 5)])} className="p-3 bg-[#020b1a] rounded-xl text-slate-400 hover:text-cyan-400 hover:bg-[#0a1e3f] transition" title="Add Dashboard PC">
                            <MonitorIcon size={24} className="text-emerald-500" />
                        </button>
                        <button onClick={() => store.addRack([Math.floor(Math.random() * 5), 0, Math.floor(Math.random() * 5)], 'network')} className="p-3 bg-[#020b1a] rounded-xl text-slate-400 hover:text-cyan-400 hover:bg-[#0a1e3f] transition" title="Add Network Rack (Switch)">
                            <Globe size={24} className="text-purple-500" />
                        </button>
                    </div>
                )}

                <div className="flex-1"></div>
                <button onClick={handleExport} className="p-3 text-slate-400 hover:text-cyan-400 transition" title="Export Layout">
                    <Download size={24} />
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-400 hover:text-cyan-400 transition" title="Import Layout">
                    <Upload size={24} />
                </button>
            </div>

            {/* 中央 3D 視窗 */}
            <div className="flex-1 relative overflow-hidden min-w-0 min-h-0">
                {/* HUD Overlay */}
                <div className="absolute top-4 left-4 z-10 pointer-events-none">
                    <h1 className="text-2xl font-black italic tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] flex items-center gap-3">
                        <Server /> 3D 動態機房
                    </h1>
                    <p className="text-xs text-cyan-700 font-mono mt-1">REAL-TIME DYNAMIC INFRASTRUCTURE</p>
                </div>

                {/* Edit Mode HUD */}
                <div className="absolute top-4 right-4 z-10 flex gap-4">
                    <button
                        onClick={() => store.setEditMode(!store.isEditMode)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold tracking-widest transition-all border ${store.isEditMode ? 'bg-cyan-600 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.5)]' : 'bg-[#0a1e3f]/80 border-[#1e3a8a] text-slate-400 hover:text-white'}`}
                    >
                        {store.isEditMode ? <Edit size={16} /> : <Lock size={16} />}
                        {store.isEditMode ? 'EDIT MODE' : 'VIEW ONLY'}
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
                    {store.racks.map((rack) => (
                        <RackModel key={rack.id} data={rack} isSelected={rack.id === store.selectedRackId} telemetry={telemetry} />
                    ))}
                    {store.equipments.map((eq) => (
                        <EquipmentModel key={eq.id} data={eq} telemetry={telemetry} />
                    ))}
                    <NetworkLines />
                    <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2 - 0.05} />
                </Canvas>
            </div>

            {/* 右側屬性面板 (Rack) */}
            {selectedRack && (
                <div className="w-80 bg-[#020b1a] border-l border-[#1e3a8a] flex flex-col z-10 shadow-[-2px_0_15px_rgba(6,182,212,0.1)]">
                    <div className="p-4 border-b border-[#1e3a8a] flex justify-between items-center bg-gradient-to-r from-transparent to-[#0a1e3f]">
                        <h2 className="text-cyan-400 font-bold tracking-widest uppercase text-xs">Rack Settings</h2>
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
                            <h3 className="text-xs font-bold text-slate-500 mb-3 tracking-widest uppercase border-b border-slate-800 pb-1">Installed Equipment</h3>
                            <div className="flex flex-col gap-2">
                                {selectedRack.servers.sort((a, b) => b.uPosition - a.uPosition).map(server => {
                                    let liveStatus = server.status;
                                    const sTel = telemetry[server.name];
                                    const metricsText = sTel 
                                        ? (server.type === 'switch' 
                                            ? `Traffic: ${(sTel.traffic_gbps || (Math.random() * 10)).toFixed(1)} Gbps | Ports: ${Math.floor((sTel.port_usage || Math.random()) * 48)}/48`
                                            : `CPU: ${sTel.cpu_usage.toFixed(1)}% | TEMP: ${sTel.temperature.toFixed(1)}°C`)
                                        : "";

                                    return (
                                        <div key={server.id} className="flex justify-between items-center text-xs bg-[#0a1e3f] p-2 rounded border border-slate-700">
                                            <div>
                                                <div className={`font-bold flex items-center gap-2 ${liveStatus === 'critical' ? 'text-red-400' : liveStatus === 'warning' ? 'text-yellow-400' : 'text-cyan-100'}`}>
                                                    <div className={`w-2 h-2 rounded-full ${liveStatus === 'critical' ? 'bg-red-500 animate-pulse' : liveStatus === 'warning' ? 'bg-yellow-500' : 'bg-cyan-500'}`}></div>
                                                    {server.name} {server.type === 'switch' && <span className="text-[9px] bg-purple-900 border border-purple-500 px-1 rounded text-purple-100 ml-1">SWITCH</span>}
                                                </div>
                                                <div className="text-slate-400 mt-1">U{server.uPosition} - U{server.uPosition + server.uHeight - 1} ({server.uHeight}U) | {server.powerKw}kW</div>
                                                {metricsText && <div className={`mt-1 font-mono text-[10px] ${liveStatus === 'critical' ? 'text-red-300' : liveStatus === 'warning' ? 'text-yellow-300' : (server.type === 'switch' ? 'text-purple-400' : 'text-cyan-700')}`}>{metricsText}</div>}
                                            </div>
                                            <button onClick={() => store.removeServerFromRack(selectedRack.id, server.id)} className="text-red-400 hover:bg-red-900/30 p-1 rounded transition">
                                                <Trash size={14} />
                                            </button>
                                        </div>
                                    );
                                })}
                                {selectedRack.servers.length === 0 && (
                                    <div className="text-xs text-slate-600 text-center py-4 border border-dashed border-slate-800 rounded">EMPTY RACK</div>
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
                        <h2 className="text-cyan-400 font-bold tracking-widest uppercase text-xs">Equipment Settings</h2>
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
