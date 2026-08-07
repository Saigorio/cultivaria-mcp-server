import dotenv from 'dotenv';
dotenv.config();

const BACKEND_URL = process.env.BACKEND_URL || 'https://cultivaria-9673f-default-rtdb.firebaseio.com';

// Fallback in-memory state — mirrors the REAL Firebase RTDB structure
const fallbackStore: Record<string, any> = {
  'flora-01': {
    id: 'flora-01',
    name: 'Vege Madres',
    stage: 'VEGETATIVE',
    status: 'ONLINE',
    currentReadings: {
      ph: 5.85,
      ec: 1.8,
      waterTemp: 16.5,
      airTemp: 17.8,
      airHumidity: 74.4,
      vpd: 0.52,
      co2: 1180,
      dissolvedOxygen: 7.9,
      waterLevel: 88,
      waterLevelOk: true,
    },
    setpoints: {
      phTarget: 6,
      phTolerance: 0.2,
      ecTarget: 1,
      ecTolerance: 0.2,
      waterTempTarget: 15,
      waterTempTolerance: 1,
      airTempTarget: 25,
      airHumidityTarget: 65,
      dissolvedOxygenTarget: 8,
      vpdTarget: 1.2,
      waterLevelTarget: 90,
    },
    climate_ac: {
      power: true,
      temp: 24,
      mode: 'cool',
      fan: 'med',
      eco: false,
      turbo: true,
      swingV: true,
      swingH: false,
      display: true,
      updatedAt: Date.now(),
    },
    actuators: {
      chillerState: 'ON',
      solenoidFillState: 'CLOSED',
      solenoidTimerEndTime: 0,
      phPumpState: 'IDLE',
      ecPumpState: 'IDLE',
      lastDoseTime: 0,
      extractorState: 'AUTO',
      ventilationState: 'AUTO_CYCLE',
    },
    strategyPlan: {
      id: 'plan-fallback',
      kitId: 'flora-01',
      strainName: 'Gorilla Glue #4',
      totalWeeks: 1,
      activeWeekIndex: 0,
      isActive: false,
      steps: [
        {
          weekNumber: 1,
          weekTitle: 'Semana 1 - Vegetativo',
          stage: 'VEGETATIVE',
          phTarget: 5.8,
          ecTarget: 1.2,
          waterTempTarget: 19.5,
          airTempTarget: 24,
          airHumidityTarget: 65,
          vpdTarget: 1.04,
          co2Target: 800,
          lightIntensityPercent: 60,
          waterRenewalDays: 7,
          observationsNotes: 'Monitorear vigor y turgencia.',
        },
      ],
    },
    calibration: {
      ecFactor: 1,
      ecOffset: -0.88,
    },
  },
};

/**
 * Fetch module data from Firebase RTDB with fallback
 */
export async function getModuleData(moduleId = 'flora-01') {
  const url = `${BACKEND_URL}/kits/${moduleId}.json`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        // Merge with defaults to ensure all required fields exist
        const fb = fallbackStore[moduleId] || fallbackStore['flora-01'];
        return {
          ...fb,
          ...data,
          currentReadings: {
            ...fb.currentReadings,
            ...(data.currentReadings || {}),
          },
          setpoints: {
            ...fb.setpoints,
            ...(data.setpoints || {}),
          },
          climate_ac: {
            ...fb.climate_ac,
            ...(data.climate_ac || {}),
          },
          actuators: {
            ...fb.actuators,
            ...(data.actuators || {}),
          },
          strategyPlan: {
            ...fb.strategyPlan,
            ...(data.strategyPlan || {}),
          },
        };
      }
    }
  } catch (error) {
    console.warn(`[FirebaseClient] Error al conectar con Firebase RTDB para ${moduleId}. Usando fallback en memoria:`, error);
  }
  return fallbackStore[moduleId] || fallbackStore['flora-01'];
}

/**
 * Patch module data in Firebase RTDB with fallback
 */
export async function updateModuleData(path: string, patchData: Record<string, any>, moduleId = 'flora-01') {
  const url = `${BACKEND_URL}/kits/${moduleId}/${path}.json`;
  console.log(`[FirebaseClient] PATCH ${url}`, JSON.stringify(patchData));
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchData),
    });

    if (res.ok) {
      const updated = await res.json();
      console.log(`[FirebaseClient] PATCH OK:`, JSON.stringify(updated));
      return { success: true, updated, fallbackUsed: false };
    } else {
      console.warn(`[FirebaseClient] PATCH failed with status ${res.status}: ${await res.text()}`);
    }
  } catch (error) {
    console.warn(`[FirebaseClient] Error PATCH en ${path}. Aplicando en estado fallback:`, error);
  }

  // Apply fallback in memory
  if (fallbackStore[moduleId]) {
    const keys = path.split('/');
    let target = fallbackStore[moduleId];
    for (let i = 0; i < keys.length - 1; i++) {
      if (!target[keys[i]]) target[keys[i]] = {};
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
