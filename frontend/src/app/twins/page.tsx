"use client";
import React, { useRef, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useDcimStore, ServerData } from "@/store/useDcimStore";
import RoomContext from "@/components/3d/RoomContext";
import RackModel from "@/components/3d/RackModel";
import { Activity, Download, Upload, Plus, Server, Trash, Save } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

export default function TwinsPage() {
    const store = useDcimStore();
    const selectedRack = store.racks.find((r) => r.id === store.selectedRackId);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form State for new server
    const [newServer, setNewServer] = useState({
        name: "SERVER-001",
        uPosition: 1,
        uHeight: 2,
        powerKw: 1.5,
        type: "server" as const,
        status: "normal" as const,
    });

    const [telemetry, setTelemetry] = useState<Record<string, any>>({});

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch("http://localhost:8000/metrics");
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
        const interval = setInterval(fetchData, 1000);
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

    const handleAddRack = () => {
        store.addRack([Math.floor(Math.random() * 5), 0, Math.floor(Math.random() * 5)]);
    };

    const handleAddServer = () => {
        if (!selectedRack) return;
        const success = store.addServerToRack(selectedRack.id, newServer);
        if (!success) {
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
                <button onClick={handleAddRack} className="p-3 bg-[#020b1a] rounded-xl text-slate-400 hover:text-cyan-400 hover:bg-[#0a1e3f] transition" title="Add Rack">
                    <Plus size={24} />
                </button>
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
                        <Server /> 3D DIGITAL TWIN
                    </h1>
                    <p className="text-xs text-cyan-700 font-mono mt-1">REAL-TIME INFRASTRUCTURE VISUALIZATION</p>
                </div>

                <Canvas
                    camera={{ position: [5, 4, 8], fov: 45 }}
                    className="w-full h-full outline-none"
                    onPointerMissed={() => store.selectRack(null)}
                >
                    <RoomContext />
                    {store.racks.map((rack) => (
                        <RackModel key={rack.id} data={rack} isSelected={rack.id === store.selectedRackId} telemetry={telemetry} />
                    ))}
                    <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2 - 0.05} />
                </Canvas>
            </div>

            {/* 右側屬性面板 */}
            {selectedRack && (
                <div className="w-80 bg-[#020b1a] border-l border-[#1e3a8a] flex flex-col z-10 shadow-[-2px_0_15px_rgba(6,182,212,0.1)]">
                    <div className="p-4 border-b border-[#1e3a8a] flex justify-between items-center bg-gradient-to-r from-transparent to-[#0a1e3f]">
                        <h2 className="text-cyan-400 font-bold tracking-widest">{selectedRack.name}</h2>
                        <button onClick={() => store.removeRack(selectedRack.id)} className="text-red-500 hover:text-red-400 transition" title="Delete Rack">
                            <Trash size={16} />
                        </button>
                    </div>

                    <div className="p-4 flex flex-col gap-6 overflow-y-auto">
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

                        {/* 現有設備清單 */}
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 mb-3 tracking-widest uppercase border-b border-slate-800 pb-1">Installed Equipment</h3>
                            <div className="flex flex-col gap-2">
                                {selectedRack.servers.sort((a, b) => b.uPosition - a.uPosition).map(server => {
                                    let liveStatus = server.status;
                                    const sTel = telemetry[server.name];
                                    let metricsText = "";
                                    if (sTel) {
                                        if (sTel.temperature > 50 || sTel.cpu_usage > 85) liveStatus = 'critical';
                                        else if (sTel.temperature > 40 || sTel.cpu_usage > 60) liveStatus = 'warning';
                                        else liveStatus = 'normal';
                                        metricsText = `CPU: ${sTel.cpu_usage.toFixed(1)}% | TEMP: ${sTel.temperature.toFixed(1)}°C`;
                                    }

                                    return (
                                        <div key={server.id} className="flex justify-between items-center text-xs bg-[#0a1e3f] p-2 rounded border border-slate-700">
                                            <div>
                                                <div className={`font-bold flex items-center gap-2 ${liveStatus === 'critical' ? 'text-red-400' : liveStatus === 'warning' ? 'text-yellow-400' : 'text-cyan-100'}`}>
                                                    <div className={`w-2 h-2 rounded-full ${liveStatus === 'critical' ? 'bg-red-500 animate-pulse' : liveStatus === 'warning' ? 'bg-yellow-500' : 'bg-cyan-500'}`}></div>
                                                    {server.name}
                                                </div>
                                                <div className="text-slate-400 mt-1">U{server.uPosition} - U{server.uPosition + server.uHeight - 1} ({server.uHeight}U) | {server.powerKw}kW</div>
                                                {metricsText && <div className={`mt-1 font-mono text-[10px] ${liveStatus === 'critical' ? 'text-red-300' : liveStatus === 'warning' ? 'text-yellow-300' : 'text-cyan-700'}`}>{metricsText}</div>}
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
                        <div className="bg-[#010613] p-4 rounded-lg border border-cyan-900/50">
                            <h3 className="text-xs font-bold text-cyan-600 mb-3 tracking-widest uppercase">Install New Server</h3>
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
                                    <Save size={16} /> MOUNT DEVICE
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
