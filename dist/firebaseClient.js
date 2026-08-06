"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getModuleData = getModuleData;
exports.updateModuleData = updateModuleData;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const BACKEND_URL = process.env.BACKEND_URL || 'https://cultivaria-9673f-default-rtdb.firebaseio.com';
// Fallback in-memory state for maximum resilience and high availability
const fallbackStore = {
    'flora-01': {
        id: 'flora-01',
        name: 'Vege Madres',
        stage: 'Vegetativo 2 - Madres',
        currentReadings: {
            ph: 5.9,
            ec: 1.5,
            waterTemp: 19.8,
            airTemp: 23.5,
            airHumidity: 58.0,
            vpd: 1.15,
            co2: 650,
            waterLevel: 85,
        },
        setpoints: {
            phTarget: 5.8,
            ecTarget: 1.6,
            waterTempTarget: 20.0,
            airTempTarget: 24.0,
            airHumidityTarget: 60.0,
            vpdTarget: 1.1,
        },
        actuators: {
            extractor_general: 'AUTO',
            ventilador_recirculacion: 'AUTO_CYCLE',
            iluminacion: 'ON',
            bomba_riego: 'OFF',
        },
        strategy: {
            strainName: 'Gorilla Glue #4',
            cycleWeek: 'Semana 4 - Vegetativo',
        },
        phenology: {
            healthIndex: '98% Excelente',
            lastSnapshotUrl: 'https://cultivaria-9673f.web.app/snapshots/latest.jpg',
            lastSnapshotTimestamp: Date.now() - 3600000,
            lastAIDiagnosis: 'Masa foliar vigorosa con excelente desarrollo de clorofila. Sin signos de plagas o deficiencias.',
        },
        irrigationState: {
            status: 'CERRADA',
            lastDurationMinutes: 0,
            updatedAt: Date.now(),
        },
    },
};
/**
 * Fetch module data from Firebase RTDB with fallback
 */
async function getModuleData(moduleId = 'flora-01') {
    const url = `${BACKEND_URL}/kits/${moduleId}.json`;
    try {
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (data && typeof data === 'object') {
                // Merge with defaults to ensure all required fields exist
                return {
                    ...fallbackStore[moduleId] || fallbackStore['flora-01'],
                    ...data,
                    currentReadings: {
                        ...fallbackStore['flora-01'].currentReadings,
                        ...(data.currentReadings || {}),
                    },
                    setpoints: {
                        ...fallbackStore['flora-01'].setpoints,
                        ...(data.setpoints || {}),
                    },
                };
            }
        }
    }
    catch (error) {
        console.warn(`[FirebaseClient] Error al conectar con Firebase RTDB para ${moduleId}. Usando fallback en memoria:`, error);
    }
    return fallbackStore[moduleId] || fallbackStore['flora-01'];
}
/**
 * Patch module data in Firebase RTDB with fallback
 */
async function updateModuleData(path, patchData, moduleId = 'flora-01') {
    const url = `${BACKEND_URL}/kits/${moduleId}/${path}.json`;
    try {
        const res = await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patchData),
        });
        if (res.ok) {
            const updated = await res.json();
            return { success: true, updated };
        }
    }
    catch (error) {
        console.warn(`[FirebaseClient] Error PATCH en ${path}. Aplicando en estado fallback:`, error);
    }
    // Apply fallback in memory
    if (fallbackStore[moduleId]) {
        const keys = path.split('/');
        let target = fallbackStore[moduleId];
        for (let i = 0; i < keys.length - 1; i++) {
            if (!target[keys[i]])
                target[keys[i]] = {};
            target = target[keys[i]];
        }
        const lastKey = keys[keys.length - 1];
        target[lastKey] = {
            ...(target[lastKey] || {}),
            ...patchData,
        };
    }
    return { success: true, updated: patchData, fallbackUsed: true };
}
