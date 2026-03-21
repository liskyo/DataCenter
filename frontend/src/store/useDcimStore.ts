import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export type ServerData = {
    id: string;
    name: string;
    uPosition: number; // 0 ~ 41 (Assuming 42U rack)
    uHeight: number;   // 1U, 2U, 4U etc.
    powerKw: number;
    type: 'server' | 'switch' | 'storage';
    status: 'normal' | 'warning' | 'critical' | 'offline';
};

export type RackData = {
    id: string;
    name: string;
    position: [number, number, number];
    rotation: [number, number, number];
    uCapacity: number; // usually 42
    maxPowerKw: number;
    servers: ServerData[];
};

type DcimState = {
    racks: RackData[];
    selectedRackId: string | null;
    addRack: (position: [number, number, number]) => void;
    updateRackPosition: (id: string, position: [number, number, number]) => void;
    removeRack: (id: string) => void;
    addServerToRack: (rackId: string, server: Omit<ServerData, 'id'>) => boolean; // Returns false if no space
    removeServerFromRack: (rackId: string, serverId: string) => void;
    selectRack: (id: string | null) => void;
    exportState: () => string;
    importState: (jsonConfig: string) => boolean;
};

export const useDcimStore = create<DcimState>((set, get) => ({
    racks: [
        {
            id: uuidv4(), name: 'RACK-A01', position: [-2.4, 0, -1.2], rotation: [0, 0, 0], uCapacity: 42, maxPowerKw: 15,
            servers: [
                { id: uuidv4(), name: 'SERVER-001', uPosition: 2, uHeight: 1, powerKw: 0.8, type: 'server', status: 'normal' },
                { id: uuidv4(), name: 'SERVER-002', uPosition: 4, uHeight: 1, powerKw: 0.8, type: 'server', status: 'normal' },
                { id: uuidv4(), name: 'SERVER-003', uPosition: 6, uHeight: 2, powerKw: 1.5, type: 'server', status: 'normal' }
            ]
        },
        {
            id: uuidv4(), name: 'RACK-A02', position: [-1.2, 0, -1.2], rotation: [0, 0, 0], uCapacity: 42, maxPowerKw: 15,
            servers: [
                { id: uuidv4(), name: 'SERVER-004', uPosition: 2, uHeight: 2, powerKw: 2.0, type: 'server', status: 'normal' },
                { id: uuidv4(), name: 'SERVER-005', uPosition: 6, uHeight: 2, powerKw: 2.0, type: 'server', status: 'normal' }
            ]
        },
        {
            id: uuidv4(), name: 'RACK-A03', position: [0, 0, -1.2], rotation: [0, 0, 0], uCapacity: 42, maxPowerKw: 25,
            servers: [
                { id: uuidv4(), name: 'SERVER-006', uPosition: 2, uHeight: 4, powerKw: 6.0, type: 'server', status: 'normal' },
                { id: uuidv4(), name: 'SERVER-007', uPosition: 8, uHeight: 4, powerKw: 6.0, type: 'server', status: 'normal' }
            ]
        },
        {
            id: uuidv4(), name: 'RACK-A04', position: [1.2, 0, -1.2], rotation: [0, 0, 0], uCapacity: 42, maxPowerKw: 15,
            servers: [
                { id: uuidv4(), name: 'SERVER-008', uPosition: 2, uHeight: 1, powerKw: 1.0, type: 'server', status: 'normal' },
                { id: uuidv4(), name: 'SERVER-009', uPosition: 5, uHeight: 2, powerKw: 1.5, type: 'server', status: 'normal' },
                { id: uuidv4(), name: 'SERVER-010', uPosition: 9, uHeight: 1, powerKw: 1.0, type: 'server', status: 'normal' }
            ]
        },
        {
            id: uuidv4(), name: 'RACK-A05', position: [2.4, 0, -1.2], rotation: [0, 0, 0], uCapacity: 42, maxPowerKw: 15,
            servers: [
                { id: uuidv4(), name: 'SERVER-011', uPosition: 2, uHeight: 8, powerKw: 8.0, type: 'server', status: 'normal' },
                { id: uuidv4(), name: 'SERVER-012', uPosition: 12, uHeight: 4, powerKw: 4.0, type: 'server', status: 'normal' }
            ]
        }
    ],
    selectedRackId: null,

    addRack: (position) => set((state) => ({
        racks: [
            ...state.racks,
            {
                id: uuidv4(),
                name: `RACK-${Math.floor(Math.random() * 1000)}`,
                position,
                rotation: [0, 0, 0],
                uCapacity: 42,
                maxPowerKw: 15,
                servers: []
            }
        ]
    })),

    updateRackPosition: (id, position) => set((state) => ({
        racks: state.racks.map(r => r.id === id ? { ...r, position } : r)
    })),

    removeRack: (id) => set((state) => ({
        racks: state.racks.filter(r => r.id !== id),
        selectedRackId: state.selectedRackId === id ? null : state.selectedRackId
    })),

    addServerToRack: (rackId, serverData) => {
        let success = false;
        set((state) => {
            const rack = state.racks.find(r => r.id === rackId);
            if (!rack) return state;

            // Check overlap logically
            const targetStart = serverData.uPosition;
            const targetEnd = serverData.uPosition + serverData.uHeight - 1;

            if (targetStart < 1 || targetEnd > rack.uCapacity) {
                return state; // Out of bounds
            }

            const hasOverlap = rack.servers.some(s => {
                const sStart = s.uPosition;
                const sEnd = s.uPosition + s.uHeight - 1;
                return Math.max(targetStart, sStart) <= Math.min(targetEnd, sEnd);
            });

            if (hasOverlap) return state;

            success = true;
            return {
                racks: state.racks.map(r => r.id === rackId ? {
                    ...r,
                    servers: [...r.servers, { ...serverData, id: uuidv4() }]
                } : r)
            };
        });
        return success;
    },

    removeServerFromRack: (rackId, serverId) => set((state) => ({
        racks: state.racks.map(r => r.id === rackId ? {
            ...r,
            servers: r.servers.filter(s => s.id !== serverId)
        } : r)
    })),

    selectRack: (id) => set({ selectedRackId: id }),

    exportState: () => {
        const state = get();
        return JSON.stringify({ racks: state.racks }, null, 2);
    },

    importState: (jsonConfig) => {
        try {
            const parsed = JSON.parse(jsonConfig);
            if (parsed && Array.isArray(parsed.racks)) {
                set({ racks: parsed.racks, selectedRackId: null });
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    }
}));
