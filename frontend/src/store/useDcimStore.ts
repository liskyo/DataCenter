import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export type ServerData = {
    id: string;
    assetId?: string; // Stable telemetry identity, independent from display name
    name: string;
    uPosition: number; // 0 ~ 41 (Assuming 42U rack)
    uHeight: number;   // 1U, 2U, 4U etc.
    powerKw: number;
    type: 'server' | 'switch' | 'storage';
    status: 'normal' | 'warning' | 'critical' | 'offline';
};

const normalizeNodeId = (value: string): string => {
    const raw = (value || "").trim().toUpperCase().replace(/\s+/g, "").replace(/_/g, "-");
    const m = raw.match(/^(SERVER|SW|IMM|CDU)-?(\d+)$/);
    if (!m) return raw;
    return `${m[1]}-${String(Number(m[2])).padStart(3, "0")}`;
};

export type EquipmentType = 'crac' | 'pdu' | 'cdu' | 'ups' | 'chiller' | 'dashboard';

export type EquipmentData = {
    id: string;
    name: string;
    type: EquipmentType;
    position: [number, number, number];
    rotation: [number, number, number];
    ipAddress?: string; // For Dashboard PC
    locationId: string; // Associated location
    connectedRackIds?: string[]; // For CDU: manually selected server racks to connect
};

export type LocationData = {
    id: string;
    name: string;
    type: 'floor' | 'region';
    width?: number;
    depth?: number;
    xMin?: number;
    xMax?: number;
    zMin?: number;
    zMax?: number;
    doorPosition?: 'front' | 'back' | 'left' | 'right';
};

export type RackType = 'server' | 'network' | 'immersion_single' | 'immersion_dual';

export type RackData = {
    id: string;
    name: string;
    type: RackType;
    position: [number, number, number];
    rotation: [number, number, number];
    uCapacity: number; // usually 42, immersion defaults to 20
    maxPowerKw: number;
    servers: ServerData[];
    connectedNetworkRackId?: string; // Link to a network rack
    connectedSwitchId?: string | null; // Targeted switch inside the network rack
    locationId: string; // Associated location
};

const normalizeImportedRacks = (rawRacks: any[]): RackData[] => {
    const usedServerIds = new Set<string>();
    const perRackIdRemap = new Map<string, Map<string, string>>();

    const normalized: RackData[] = rawRacks
        .filter((r): r is RackData => !!r && typeof r.id === "string" && Array.isArray(r.servers))
        .map((rack: any) => {
            const idRemap = new Map<string, string>();
            const safeServers: ServerData[] = (Array.isArray(rack.servers) ? rack.servers : []).map((server: any) => {
                const rawId = typeof server?.id === "string" ? server.id : "";
                let nextId = rawId;
                if (!nextId || usedServerIds.has(nextId)) {
                    nextId = uuidv4();
                }
                usedServerIds.add(nextId);
                if (rawId && rawId !== nextId) {
                    idRemap.set(rawId, nextId);
                }

                return {
                    id: nextId,
                    assetId: typeof server?.assetId === "string" && server.assetId
                        ? normalizeNodeId(server.assetId)
                        : normalizeNodeId(typeof server?.name === "string" ? server.name : nextId),
                    name: typeof server?.name === "string" ? server.name : `SERVER-${Math.floor(Math.random() * 1000)}`,
                    uPosition: Number.isFinite(server?.uPosition) ? Math.max(1, Math.floor(server.uPosition)) : 1,
                    uHeight: Number.isFinite(server?.uHeight) ? Math.max(1, Math.floor(server.uHeight)) : 1,
                    powerKw: Number.isFinite(server?.powerKw) ? Number(server.powerKw) : 0.5,
                    type: server?.type === "switch" || server?.type === "storage" ? server.type : "server",
                    status: server?.status === "warning" || server?.status === "critical" || server?.status === "offline"
                        ? server.status
                        : "normal",
                };
            });

            if (idRemap.size > 0) {
                perRackIdRemap.set(rack.id, idRemap);
            }

            return {
                ...rack,
                servers: safeServers,
            };
        });

    // Keep rack-to-switch links valid after server.id dedupe/rebuild.
    return normalized.map((rack) => {
        const targetNetworkRackId = rack.connectedNetworkRackId;
        if (!targetNetworkRackId || !rack.connectedSwitchId) return rack;

        const targetRemap = perRackIdRemap.get(targetNetworkRackId);
        if (!targetRemap) return rack;

        const mappedSwitchId = targetRemap.get(rack.connectedSwitchId);
        if (!mappedSwitchId) return rack;

        return {
            ...rack,
            connectedSwitchId: mappedSwitchId,
        };
    });
};

type DcimState = {
    isEditMode: boolean;
    setEditMode: (mode: boolean) => void;

    racks: RackData[];
    selectedRackId: string | null;

    equipments: EquipmentData[];
    selectedEquipmentId: string | null;

    locations: LocationData[];
    currentLocationId: string;

    addLocation: (name: string, type: 'floor' | 'region') => void;
    setCurrentLocation: (id: string) => void;
    removeLocation: (id: string) => void;
    updateLocationName: (id: string, name: string) => void;
    updateLocationProps: (id: string, props: Partial<LocationData>) => void;

    addRack: (position: [number, number, number], type?: RackType) => void;
    updateRackPosition: (id: string, position: [number, number, number]) => void;
    updateRackRotation: (id: string, rotation: [number, number, number]) => void;
    updateRackConnection: (id: string, networkRackId: string | null, switchId?: string | null) => void;
    updateRackName: (id: string, name: string) => void;
    removeRack: (id: string) => void;
    addServerToRack: (rackId: string, server: Omit<ServerData, 'id' | 'assetId'>) => boolean; // Returns false if no space
    removeServerFromRack: (rackId: string, serverId: string) => void;
    updateServerInRack: (rackId: string, serverId: string, patch: Partial<Omit<ServerData, 'id' | 'assetId'>>) => boolean;
    selectRack: (id: string | null) => void;

    addEquipment: (type: EquipmentType, position: [number, number, number]) => void;
    updateEquipmentPosition: (id: string, position: [number, number, number]) => void;
    updateEquipmentRotation: (id: string, rotation: [number, number, number]) => void;
    removeEquipment: (id: string) => void;
    selectEquipment: (id: string | null) => void;
    updateEquipmentIp: (id: string, ip: string) => void;
    updateEquipmentName: (id: string, name: string) => void;
    updateEquipmentConnectedRacks: (id: string, rackIds: string[]) => void;

    exportState: () => string;
    importState: (jsonConfig: string) => boolean;
};

export const useDcimStore = create<DcimState>()(
    persist(
        (set, get) => ({
            isEditMode: false,
            setEditMode: (mode) => set({ isEditMode: mode, selectedRackId: null, selectedEquipmentId: null }),

            locations: [
                { id: 'default-loc', name: '1F Core DC', type: 'floor', xMin: -10, xMax: 10, zMin: -7.5, zMax: 7.5 }
            ],
            currentLocationId: 'default-loc',

            equipments: [
                { id: uuidv4(), name: 'CRAC-01', type: 'crac', position: [-4, 0, -5], rotation: [0, 0, 0], locationId: 'default-loc' },
                { id: uuidv4(), name: 'CRAC-02', type: 'crac', position: [0, 0, -5], rotation: [0, 0, 0], locationId: 'default-loc' },
                { id: uuidv4(), name: 'CRAC-03', type: 'crac', position: [4, 0, -5], rotation: [0, 0, 0], locationId: 'default-loc' },
                { id: uuidv4(), name: 'PDU-A', type: 'pdu', position: [-8, 0, -2], rotation: [0, 0, 0], locationId: 'default-loc' },
                { id: uuidv4(), name: 'PDU-B', type: 'pdu', position: [-8, 0, 2], rotation: [0, 0, 0], locationId: 'default-loc' }
            ],
            selectedEquipmentId: null,

            racks: [
                {
                    id: uuidv4(), name: 'RACK-A01', type: 'server', position: [-2.4, 0, -1.2], rotation: [0, 0, 0], uCapacity: 42, maxPowerKw: 15, locationId: 'default-loc',
                    servers: [
                        { id: uuidv4(), assetId: 'SERVER-001', name: 'SERVER-001', uPosition: 2, uHeight: 1, powerKw: 0.8, type: 'server', status: 'normal' },
                        { id: uuidv4(), assetId: 'SERVER-002', name: 'SERVER-002', uPosition: 4, uHeight: 1, powerKw: 0.8, type: 'server', status: 'normal' },
                        { id: uuidv4(), assetId: 'SERVER-003', name: 'SERVER-003', uPosition: 6, uHeight: 2, powerKw: 1.5, type: 'server', status: 'normal' }
                    ]
                },
                {
                    id: uuidv4(), name: 'RACK-A02', type: 'server', position: [-1.2, 0, -1.2], rotation: [0, 0, 0], uCapacity: 42, maxPowerKw: 15, locationId: 'default-loc',
                    servers: [
                        { id: uuidv4(), assetId: 'SERVER-004', name: 'SERVER-004', uPosition: 2, uHeight: 2, powerKw: 2.0, type: 'server', status: 'normal' },
                        { id: uuidv4(), assetId: 'SERVER-005', name: 'SERVER-005', uPosition: 6, uHeight: 2, powerKw: 2.0, type: 'server', status: 'normal' }
                    ]
                },
                {
                    id: uuidv4(), name: 'NET-RACK-01', type: 'network', position: [0, 0, -4.5], rotation: [0, 0, 0], uCapacity: 42, maxPowerKw: 15, locationId: 'default-loc',
                    servers: []
                }
            ],
            selectedRackId: null,

            addRack: (position, type = 'server') => set((state) => {
                const nameMap: Record<RackType, string> = {
                    server: `RACK-${Math.floor(Math.random() * 1000)}`,
                    network: `NET-RACK-${Math.floor(Math.random() * 1000)}`,
                    immersion_single: `IMM-1P-${Math.floor(Math.random() * 1000)}`,
                    immersion_dual: `IMM-2P-${Math.floor(Math.random() * 1000)}`,
                };
                const isImmersion = type === 'immersion_single' || type === 'immersion_dual';
                return {
                    racks: [
                        ...state.racks,
                        {
                            id: uuidv4(),
                            name: nameMap[type],
                            type,
                            position,
                            rotation: [0, 0, 0],
                            uCapacity: isImmersion ? 20 : 42,
                            maxPowerKw: isImmersion ? 30 : 15,
                            servers: [],
                            locationId: state.currentLocationId
                        }
                    ]
                };
            }),

            updateRackConnection: (id, networkRackId, switchId = null) => set((state) => ({
                racks: state.racks.map(r => r.id === id ? { ...r, connectedNetworkRackId: networkRackId || undefined, connectedSwitchId: switchId } : r)
            })),

            updateRackPosition: (id, position) => set((state) => ({
                racks: state.racks.map(r => r.id === id ? { ...r, position } : r)
            })),

            updateRackRotation: (id, rotation) => set((state) => ({
                racks: state.racks.map(r => r.id === id ? { ...r, rotation } : r)
            })),

            updateRackName: (id, name) => set((state) => ({
                racks: state.racks.map(r => r.id === id ? { ...r, name } : r)
            })),

            removeRack: (id) => set((state) => ({
                racks: state.racks.filter(r => r.id !== id),
                selectedRackId: state.selectedRackId === id ? null : state.selectedRackId
            })),

            addServerToRack: (rackId, serverData) => {
                let success = false;
                set((state: any) => {
                    const rack = state.racks.find((r: any) => r.id === rackId);
                    if (!rack) return state;

                    // Check overlap logically
                    const targetStart = serverData.uPosition;
                    const targetEnd = serverData.uPosition + serverData.uHeight - 1;

                    if (targetStart < 1 || targetEnd > rack.uCapacity) {
                        return state; // Out of bounds
                    }

                    const hasOverlap = rack.servers.some((s: any) => {
                        const sStart = s.uPosition;
                        const sEnd = s.uPosition + s.uHeight - 1;
                        return Math.max(targetStart, sStart) <= Math.min(targetEnd, sEnd);
                    });

                    if (hasOverlap) return state;

                    success = true;
                    return {
                        racks: state.racks.map((r: any) => r.id === rackId ? {
                            ...r,
                            servers: [...r.servers, { ...serverData, id: uuidv4(), assetId: normalizeNodeId(serverData.name) }]
                        } : r)
                    };
                });
                return success;
            },

            removeServerFromRack: (rackId, serverId) => set((state: any) => ({
                racks: state.racks.map((r: any) => r.id === rackId ? {
                    ...r,
                    servers: r.servers.filter((s: any) => s.id !== serverId)
                } : r)
            })),

            updateServerInRack: (rackId, serverId, patch) => {
                let success = false;
                set((state: any) => {
                    const rack = state.racks.find((r: any) => r.id === rackId);
                    if (!rack) return state;

                    const existing = rack.servers.find((s: any) => s.id === serverId);
                    if (!existing) return state;

                    const next = { ...existing, ...patch } as ServerData;

                    const nextUPosition = Math.floor(next.uPosition);
                    const nextUHeight = Math.floor(next.uHeight);

                    if (!Number.isFinite(nextUPosition) || !Number.isFinite(nextUHeight)) return state;
                    if (nextUPosition < 1) return state;
                    if (nextUHeight < 1) return state;

                    const targetStart = nextUPosition;
                    const targetEnd = nextUPosition + nextUHeight - 1;
                    if (targetStart < 1 || targetEnd > rack.uCapacity) return state;

                    // Ensure global uniqueness if name is being updated.
                    if (typeof patch.name === "string" && patch.name !== existing.name) {
                        const allOtherServers = state.racks.flatMap((r2: any) => r2.servers).filter((s2: any) => s2.id !== serverId);
                        if (allOtherServers.some((s2: any) => s2.name === patch.name)) return state;
                    }

                    const hasOverlap = rack.servers.some((s: any) => {
                        if (s.id === serverId) return false;
                        const sStart = s.uPosition;
                        const sEnd = s.uPosition + s.uHeight - 1;
                        return Math.max(targetStart, sStart) <= Math.min(targetEnd, sEnd);
                    });
                    if (hasOverlap) return state;

                    success = true;
                    return {
                        ...state,
                        racks: state.racks.map((r: any) => {
                            if (r.id !== rackId) return r;
                            return {
                                ...r,
                                servers: r.servers.map((s: any) => {
                                    if (s.id !== serverId) return s;
                                    return {
                                        ...s,
                                        ...next,
                                        assetId: s.assetId || normalizeNodeId(next.name),
                                        uPosition: nextUPosition,
                                        uHeight: nextUHeight,
                                    };
                                }),
                            };
                        }),
                    };
                });
                return success;
            },

            selectRack: (id) => set({ selectedRackId: id, selectedEquipmentId: null }),

            addEquipment: (type, position) => set((state) => ({
                equipments: [
                    ...state.equipments,
                    {
                        id: uuidv4(),
                        name: `${type.toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
                        type,
                        position,
                        rotation: [0, 0, 0],
                        locationId: state.currentLocationId // Assign to current location
                    }
                ]
            })),

            updateEquipmentPosition: (id, position) => set((state: any) => ({
                equipments: state.equipments.map((e: any) => e.id === id ? { ...e, position } : e)
            })),

            updateEquipmentRotation: (id, rotation) => set((state: any) => ({
                equipments: state.equipments.map((e: any) => e.id === id ? { ...e, rotation } : e)
            })),

            removeEquipment: (id) => set((state: any) => ({
                equipments: state.equipments.filter((e: any) => e.id !== id),
                selectedEquipmentId: state.selectedEquipmentId === id ? null : state.selectedEquipmentId
            })),

            selectEquipment: (id) => set({ selectedEquipmentId: id, selectedRackId: null }),

            updateEquipmentIp: (id, ip) => set((state: any) => ({
                equipments: state.equipments.map((e: any) => e.id === id ? { ...e, ipAddress: ip } : e)
            })),

            updateEquipmentName: (id, name) => set((state: any) => ({
                equipments: state.equipments.map((e: any) => e.id === id ? { ...e, name } : e)
            })),

            updateEquipmentConnectedRacks: (id, rackIds) => set((state: any) => ({
                equipments: state.equipments.map((e: any) => e.id === id ? { ...e, connectedRackIds: rackIds } : e)
            })),

            addLocation: (name, type) => set((state: any) => ({
                locations: [...state.locations, { 
                    id: uuidv4(), 
                    name, 
                    type, 
                    width: 20, 
                    depth: 15,
                    xMin: -10,
                    xMax: 10,
                    zMin: -7.5,
                    zMax: 7.5,
                    doorPosition: 'right' 
                }]
            })),

            setCurrentLocation: (id) => set({ currentLocationId: id, selectedRackId: null, selectedEquipmentId: null }),

            removeLocation: (id) => set((state: any) => {
                if (state.locations.length <= 1) return state; // Keep at least one
                const newLocations = state.locations.filter((l: any) => l.id !== id);
                const newCurrentId = state.currentLocationId === id ? newLocations[0].id : state.currentLocationId;
                return {
                    locations: newLocations,
                    currentLocationId: newCurrentId,
                    racks: state.racks.filter((r: any) => r.locationId !== id),
                    equipments: state.equipments.filter((e: any) => e.locationId !== id)
                };
            }),

            updateLocationName: (id, name) => set((state: any) => ({
                locations: state.locations.map((l: any) => l.id === id ? { ...l, name } : l)
            })),

            updateLocationProps: (id, props) => set((state: any) => ({
                locations: state.locations.map((l: any) => l.id === id ? { ...l, ...props } : l)
            })),

            exportState: () => {
                const state = get();
                return JSON.stringify({ 
                    racks: state.racks, 
                    equipments: state.equipments, 
                    locations: state.locations, 
                    currentLocationId: state.currentLocationId 
                }, null, 2);
            },

            importState: (jsonConfig) => {
                try {
                    const parsed = JSON.parse(jsonConfig);
                    if (parsed && Array.isArray(parsed.racks)) {
                        const normalizedRacks = normalizeImportedRacks(parsed.racks);
                        set({
                            racks: normalizedRacks,
                            equipments: Array.isArray(parsed.equipments) ? parsed.equipments : get().equipments,
                            locations: Array.isArray(parsed.locations) ? parsed.locations : get().locations,
                            currentLocationId: parsed.currentLocationId || get().currentLocationId,
                            selectedRackId: null,
                            selectedEquipmentId: null
                        });
                        return true;
                    }
                    return false;
                } catch (e) {
                    return false;
                }
            }
        }),
        {
            name: 'datacenter-storage-v3', // key in localStorage - Updated to v3 for location support
            partialize: (state) => ({ 
                racks: state.racks, 
                equipments: state.equipments, 
                locations: state.locations, 
                currentLocationId: state.currentLocationId 
            }),
            merge: (persistedState, currentState) => {
                const persisted = (persistedState ?? {}) as Partial<DcimState>;
                const fallbackLocation = { id: 'default-loc', name: '1F Core DC', type: 'floor' as const };

                const locations = Array.isArray(persisted.locations)
                    ? persisted.locations.filter(
                        (l): l is LocationData =>
                            !!l &&
                            typeof l.id === "string" &&
                            typeof l.name === "string" &&
                            (l.type === "floor" || l.type === "region")
                    )
                    : [];

                const safeLocations = locations.length > 0
                    ? locations.map(l => {
                        // Migrate legacy width/depth if boundaries are missing
                        const nl = { ...l };
                        if (nl.xMin === undefined || nl.xMax === undefined) {
                            const w = nl.width || 20;
                            nl.xMin = -w / 2;
                            nl.xMax = w / 2;
                        }
                        if (nl.zMin === undefined || nl.zMax === undefined) {
                            const d = nl.depth || 15;
                            nl.zMin = -d / 2;
                            nl.zMax = d / 2;
                        }
                        return nl;
                    })
                    : currentState.locations.length > 0
                        ? currentState.locations
                        : [
                            { 
                                ...fallbackLocation, 
                                xMin: -10, xMax: 10, zMin: -7.5, zMax: 7.5 
                            }
                        ];

                const locationIdSet = new Set(safeLocations.map((l) => l.id));
                const currentLocationId = typeof persisted.currentLocationId === "string" && locationIdSet.has(persisted.currentLocationId)
                    ? persisted.currentLocationId
                    : safeLocations[0].id;

                return {
                    ...currentState,
                    ...persisted,
                    racks: Array.isArray(persisted.racks)
                        ? normalizeImportedRacks(persisted.racks)
                        : currentState.racks,
                    equipments: Array.isArray(persisted.equipments)
                        ? persisted.equipments.filter((e): e is EquipmentData => !!e && typeof e.id === "string" && Array.isArray(e.position))
                        : currentState.equipments,
                    locations: safeLocations,
                    currentLocationId,
                };
            },
        })
);
