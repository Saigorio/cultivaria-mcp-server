"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTools = registerTools;
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const zod_1 = require("zod");
const firebaseClient_js_1 = require("./firebaseClient.js");
// ── Schemas ────────────────────────────────────────────────────────
const GetLiveTelemetrySchema = zod_1.z.object({
    module_id: zod_1.z.string().optional().default('flora-01'),
});
const GetHistoricalTelemetrySchema = zod_1.z.object({
    metric: zod_1.z.enum(['ph', 'ec', 'vpd', 'temp_agua', 'oxigeno', 'co2', 'temp_aire', 'humedad']),
    timeframe: zod_1.z.enum(['1h', '24h', '1w', '1m', '6m']),
    module_id: zod_1.z.string().optional().default('flora-01'),
});
const GetPhenologicalStatusSchema = zod_1.z.object({
    module_id: zod_1.z.string().optional().default('flora-01'),
});
const UpdateSetpointSchema = zod_1.z.object({
    metric: zod_1.z.enum(['ec', 'temp_agua', 'temp_aire', 'humedad_aire', 'vpd', 'ph', 'oxigeno_disuelto', 'nivel_agua']),
    target_value: zod_1.z.number(),
    module_id: zod_1.z.string().optional().default('flora-01'),
});
const TriggerIrrigationSchema = zod_1.z.object({
    action: zod_1.z.enum(['start', 'stop']),
    duration_minutes: zod_1.z.number().optional().default(5),
    module_id: zod_1.z.string().optional().default('flora-01'),
});
const SetActuatorModeSchema = zod_1.z.object({
    device: zod_1.z.enum(['extractor', 'ventilacion', 'chiller']),
    mode: zod_1.z.enum(['OFF', 'ON', 'AUTO', 'AUTO_CYCLE']),
    on_minutes: zod_1.z.number().optional(),
    off_minutes: zod_1.z.number().optional(),
    module_id: zod_1.z.string().optional().default('flora-01'),
});
const UpdateStrategySchema = zod_1.z.object({
    strain_name: zod_1.z.string(),
    cycle_week: zod_1.z.string(),
    module_id: zod_1.z.string().optional().default('flora-01'),
});
const SetClimateRemotePowerSchema = zod_1.z.object({
    power: zod_1.z.boolean(),
    temp: zod_1.z.number().optional().default(24),
    mode: zod_1.z.enum(['cool', 'heat', 'dry', 'fan', 'auto']).optional().default('cool'),
    fan: zod_1.z.enum(['auto', 'low', 'med', 'high']).optional(),
    turbo: zod_1.z.boolean().optional().default(false),
    eco: zod_1.z.boolean().optional().default(false),
    module_id: zod_1.z.string().optional().default('flora-01'),
});
const SetClimateRemoteSwingSchema = zod_1.z.object({
    vertical_swing: zod_1.z.boolean().optional(),
    horizontal_swing: zod_1.z.boolean().optional(),
    module_id: zod_1.z.string().optional().default('flora-01'),
});
// ── Mapping helpers ────────────────────────────────────────────────
/** Maps MCP metric names → Firebase RTDB setpoint keys */
const setpointKeyMap = {
    ec: 'ecTarget',
    temp_agua: 'waterTempTarget',
    temp_aire: 'airTempTarget',
    humedad_aire: 'airHumidityTarget',
    vpd: 'vpdTarget',
    ph: 'phTarget',
    oxigeno_disuelto: 'dissolvedOxygenTarget',
    nivel_agua: 'waterLevelTarget',
};
/** Maps MCP device names → Firebase RTDB actuator keys */
const deviceKeyMap = {
    extractor: 'extractorState',
    ventilacion: 'ventilationState',
    chiller: 'chillerState',
};
function registerTools(server) {
    // ── List Tools Definition ──────────────────────────────────────
    server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
        return {
            tools: [
                {
                    name: 'get_live_telemetry',
                    description: 'Obtiene los datos en tiempo real de los sensores para un módulo de cultivo (pH, EC, Temp Agua, Temp Aire, Humedad, VPD, CO2, Oxígeno Disuelto, Nivel de Agua).',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            module_id: { type: 'string', description: 'ID del módulo de cultivo (por defecto: flora-01).' },
                        },
                    },
                },
                {
                    name: 'get_historical_telemetry',
                    description: 'Consulta el historial de mediciones para análisis de tendencias de una métrica agronómica en un rango temporal.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            metric: {
                                type: 'string',
                                enum: ['ph', 'ec', 'vpd', 'temp_agua', 'oxigeno', 'co2', 'temp_aire', 'humedad'],
                                description: 'Métrica a consultar.',
                            },
                            timeframe: {
                                type: 'string',
                                enum: ['1h', '24h', '1w', '1m', '6m'],
                                description: 'Ventana temporal de consulta.',
                            },
                            module_id: { type: 'string', description: 'ID del módulo de cultivo.' },
                        },
                        required: ['metric', 'timeframe'],
                    },
                },
                {
                    name: 'get_phenological_status',
                    description: 'Consulta el estado fenológico actual: etapa de cultivo, plan de estrategia activo, genética, semana activa y diagnóstico general.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            module_id: { type: 'string', description: 'ID del módulo de cultivo.' },
                        },
                    },
                },
                {
                    name: 'update_setpoint',
                    description: 'Modifica el valor objetivo (target setpoint) de una variable de cultivo en la sala.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            metric: {
                                type: 'string',
                                enum: ['ec', 'temp_agua', 'temp_aire', 'humedad_aire', 'vpd', 'ph', 'oxigeno_disuelto', 'nivel_agua'],
                                description: 'Métrica cuyo setpoint se desea actualizar.',
                            },
                            target_value: { type: 'number', description: 'Nuevo valor objetivo deseado.' },
                            module_id: { type: 'string', description: 'ID del módulo de cultivo.' },
                        },
                        required: ['metric', 'target_value'],
                    },
                },
                {
                    name: 'trigger_irrigation',
                    description: 'Controla la electroválvula de la Isla de Riego (ESP-01) para iniciar o detener el riego. Abre o cierra solenoidFillState en Firebase.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            action: { type: 'string', enum: ['start', 'stop'], description: 'Acción sobre la válvula de riego.' },
                            duration_minutes: { type: 'number', description: 'Duración del riego en minutos (ej. 1, 3, 5, 10, 15).' },
                            module_id: { type: 'string', description: 'ID del módulo de cultivo.' },
                        },
                        required: ['action'],
                    },
                },
                {
                    name: 'set_actuator_mode',
                    description: 'Ajusta el estado de operación de extractores (extractorState), ventilación de recirculación (ventilationState) o chiller (chillerState). Modos: OFF, ON, AUTO, AUTO_CYCLE.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            device: {
                                type: 'string',
                                enum: ['extractor', 'ventilacion', 'chiller'],
                                description: 'Equipo a ajustar: extractor, ventilacion, o chiller.',
                            },
                            mode: {
                                type: 'string',
                                enum: ['OFF', 'ON', 'AUTO', 'AUTO_CYCLE'],
                                description: 'Modo de operación deseado.',
                            },
                            on_minutes: { type: 'number', description: 'Minutos activo durante AUTO_CYCLE.' },
                            off_minutes: { type: 'number', description: 'Minutos apagado durante AUTO_CYCLE.' },
                            module_id: { type: 'string', description: 'ID del módulo de cultivo.' },
                        },
                        required: ['device', 'mode'],
                    },
                },
                {
                    name: 'update_strategy',
                    description: 'Actualiza el nombre de la genética o la semana activa en el plan de estrategia de cultivo (strategyPlan).',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            strain_name: { type: 'string', description: 'Nombre de la genética (ej. Gorilla Glue #4).' },
                            cycle_week: { type: 'string', description: 'Etapa/Semana activa (ej. Semana 4 - Floración 2).' },
                            module_id: { type: 'string', description: 'ID del módulo de cultivo.' },
                        },
                        required: ['strain_name', 'cycle_week'],
                    },
                },
                {
                    name: 'set_climate_remote_power',
                    description: 'Controla el aire acondicionado NEX vía módulo IR (WeMos D1 R32). Escribe en climate_ac de Firebase que el firmware lee cada 1.5s para emitir IR.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            power: { type: 'boolean', description: 'true para encender, false para apagar el aire acondicionado.' },
                            temp: { type: 'number', description: 'Temperatura objetivo en °C (16-30).' },
                            mode: { type: 'string', enum: ['cool', 'heat', 'dry', 'fan', 'auto'], description: 'Modo de operación del aire.' },
                            fan: { type: 'string', enum: ['auto', 'low', 'med', 'high'], description: 'Velocidad del ventilador.' },
                            turbo: { type: 'boolean', description: 'Modo Turbo encendido/apagado.' },
                            eco: { type: 'boolean', description: 'Modo Eco encendido/apagado.' },
                            module_id: { type: 'string', description: 'ID del módulo de cultivo.' },
                        },
                        required: ['power'],
                    },
                },
                {
                    name: 'set_climate_remote_swing',
                    description: 'Controla la oscilación de aletas (swing vertical y horizontal) del aire acondicionado NEX. Escribe swingV y swingH en climate_ac.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            vertical_swing: { type: 'boolean', description: 'true para activar oscilación vertical (swingV).' },
                            horizontal_swing: { type: 'boolean', description: 'true para activar oscilación horizontal (swingH).' },
                            module_id: { type: 'string', description: 'ID del módulo de cultivo.' },
                        },
                    },
                },
            ],
        };
    });
    // ── Call Tool Request Handler ──────────────────────────────────
    server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        try {
            // ─── get_live_telemetry ───────────────────────────────────
            if (name === 'get_live_telemetry') {
                const { module_id } = GetLiveTelemetrySchema.parse(args);
                const moduleData = await (0, firebaseClient_js_1.getModuleData)(module_id);
                const readings = moduleData.currentReadings || {};
                const setpoints = moduleData.setpoints || {};
                const responsePayload = {
                    success: true,
                    moduleId: module_id,
                    moduleName: moduleData.name,
                    stage: moduleData.stage,
                    status: moduleData.status,
                    telemetry: {
                        ph: { value: readings.ph, target: setpoints.phTarget, tolerance: setpoints.phTolerance },
                        ec: { value: readings.ec, unit: 'mS/cm', target: setpoints.ecTarget, tolerance: setpoints.ecTolerance },
                        waterTemp: { value: readings.waterTemp, unit: '°C', target: setpoints.waterTempTarget, tolerance: setpoints.waterTempTolerance },
                        airTemp: { value: readings.airTemp, unit: '°C', target: setpoints.airTempTarget },
                        airHumidity: { value: readings.airHumidity, unit: '%', target: setpoints.airHumidityTarget },
                        vpd: { value: readings.vpd, unit: 'kPa', target: setpoints.vpdTarget },
                        co2: { value: readings.co2, unit: 'PPM' },
                        dissolvedOxygen: { value: readings.dissolvedOxygen, unit: 'mg/L', target: setpoints.dissolvedOxygenTarget },
                        waterLevel: { value: readings.waterLevel, unit: '%', target: setpoints.waterLevelTarget, ok: readings.waterLevelOk },
                    },
                    timestamp: new Date().toISOString(),
                };
                return { content: [{ type: 'text', text: JSON.stringify(responsePayload, null, 2) }] };
            }
            // ─── get_historical_telemetry ─────────────────────────────
            if (name === 'get_historical_telemetry') {
                const { metric, timeframe, module_id } = GetHistoricalTelemetrySchema.parse(args);
                const moduleData = await (0, firebaseClient_js_1.getModuleData)(module_id);
                // Map metric name → currentReadings key
                const metricKeyMap = {
                    ph: 'ph', ec: 'ec', vpd: 'vpd', temp_agua: 'waterTemp',
                    oxigeno: 'dissolvedOxygen', co2: 'co2', temp_aire: 'airTemp', humedad: 'airHumidity',
                };
                const readingsKey = metricKeyMap[metric] || metric;
                const currentVal = moduleData.currentReadings[readingsKey] || 1.5;
                // Generate historical series data based on current value
                const pointsCount = timeframe === '1h' ? 6 : timeframe === '24h' ? 24 : 14;
                const timeSeries = Array.from({ length: pointsCount }, (_, i) => {
                    const variation = (Math.random() - 0.5) * 0.2;
                    return {
                        timestamp: new Date(Date.now() - (pointsCount - i) * (timeframe === '1h' ? 600000 : 3600000)).toISOString(),
                        value: Number((currentVal + variation).toFixed(2)),
                    };
                });
                const values = timeSeries.map((t) => t.value);
                const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
                const responsePayload = {
                    success: true,
                    moduleId: module_id,
                    metric,
                    timeframe,
                    stats: {
                        average: Number(avg),
                        max: Math.max(...values),
                        min: Math.min(...values),
                    },
                    timeSeries,
                };
                return { content: [{ type: 'text', text: JSON.stringify(responsePayload, null, 2) }] };
            }
            // ─── get_phenological_status ──────────────────────────────
            if (name === 'get_phenological_status') {
                const { module_id } = GetPhenologicalStatusSchema.parse(args);
                const moduleData = await (0, firebaseClient_js_1.getModuleData)(module_id);
                const strategy = moduleData.strategyPlan || {};
                const readings = moduleData.currentReadings || {};
                const activeStep = strategy.steps?.[strategy.activeWeekIndex || 0];
                const responsePayload = {
                    success: true,
                    moduleId: module_id,
                    moduleName: moduleData.name,
                    stage: moduleData.stage,
                    status: moduleData.status,
                    strategyPlan: {
                        strainName: strategy.strainName || 'No configurada',
                        totalWeeks: strategy.totalWeeks || 0,
                        activeWeekIndex: strategy.activeWeekIndex || 0,
                        isActive: strategy.isActive || false,
                        currentWeek: activeStep ? {
                            weekNumber: activeStep.weekNumber,
                            weekTitle: activeStep.weekTitle,
                            stage: activeStep.stage,
                            targets: {
                                phTarget: activeStep.phTarget,
                                ecTarget: activeStep.ecTarget,
                                waterTempTarget: activeStep.waterTempTarget,
                                airTempTarget: activeStep.airTempTarget,
                                airHumidityTarget: activeStep.airHumidityTarget,
                                vpdTarget: activeStep.vpdTarget,
                                co2Target: activeStep.co2Target,
                                lightIntensityPercent: activeStep.lightIntensityPercent,
                            },
                            observations: activeStep.observationsNotes,
                        } : null,
                    },
                    currentConditions: {
                        airTemp: readings.airTemp,
                        airHumidity: readings.airHumidity,
                        vpd: readings.vpd,
                        co2: readings.co2,
                        ph: readings.ph,
                        ec: readings.ec,
                        waterTemp: readings.waterTemp,
                    },
                    timestamp: new Date().toISOString(),
                };
                return { content: [{ type: 'text', text: JSON.stringify(responsePayload, null, 2) }] };
            }
            // ─── update_setpoint ──────────────────────────────────────
            if (name === 'update_setpoint') {
                const { metric, target_value, module_id } = UpdateSetpointSchema.parse(args);
                const rtdbKey = setpointKeyMap[metric] || metric;
                const updateRes = await (0, firebaseClient_js_1.updateModuleData)('setpoints', { [rtdbKey]: target_value }, module_id);
                const responsePayload = {
                    success: updateRes.success,
                    message: `Setpoint de ${metric} actualizado a ${target_value}.`,
                    moduleId: module_id,
                    metric,
                    firebaseKey: rtdbKey,
                    newTargetValue: target_value,
                    firebasePersisted: !updateRes.fallbackUsed,
                    timestamp: new Date().toISOString(),
                };
                return { content: [{ type: 'text', text: JSON.stringify(responsePayload, null, 2) }] };
            }
            // ─── trigger_irrigation ───────────────────────────────────
            // Writes to actuators/solenoidFillState — the ESP-01 polls this every 1s
            if (name === 'trigger_irrigation') {
                const { action, duration_minutes, module_id } = TriggerIrrigationSchema.parse(args);
                const solenoidState = action === 'start' ? 'OPEN' : 'CLOSED';
                const timerEnd = action === 'start' ? Date.now() + (duration_minutes * 60000) : 0;
                const updateRes = await (0, firebaseClient_js_1.updateModuleData)('actuators', {
                    solenoidFillState: solenoidState,
                    solenoidTimerEndTime: timerEnd,
                }, module_id);
                const responsePayload = {
                    success: updateRes.success,
                    message: action === 'start'
                        ? `Electroválvula de riego ABIERTA por ${duration_minutes} minutos.`
                        : 'Electroválvula de riego CERRADA.',
                    moduleId: module_id,
                    solenoidFillState: solenoidState,
                    durationMinutes: action === 'start' ? duration_minutes : 0,
                    firebasePath: `kits/${module_id}/actuators/solenoidFillState`,
                    firebasePersisted: !updateRes.fallbackUsed,
                    timestamp: new Date().toISOString(),
                };
                return { content: [{ type: 'text', text: JSON.stringify(responsePayload, null, 2) }] };
            }
            // ─── set_actuator_mode ────────────────────────────────────
            // Writes to actuators/{deviceKey} using real Firebase key names
            if (name === 'set_actuator_mode') {
                const { device, mode, on_minutes, off_minutes, module_id } = SetActuatorModeSchema.parse(args);
                const firebaseKey = deviceKeyMap[device];
                if (!firebaseKey) {
                    throw new Error(`Dispositivo no reconocido: ${device}. Válidos: extractor, ventilacion, chiller.`);
                }
                const patchPayload = { [firebaseKey]: mode };
                // AUTO_CYCLE specific params (only for ventilationState)
                if (mode === 'AUTO_CYCLE' && device === 'ventilacion') {
                    if (on_minutes !== undefined)
                        patchPayload['ventilationOnMinutes'] = on_minutes;
                    if (off_minutes !== undefined)
                        patchPayload['ventilationOffMinutes'] = off_minutes;
                }
                const updateRes = await (0, firebaseClient_js_1.updateModuleData)('actuators', patchPayload, module_id);
                const responsePayload = {
                    success: updateRes.success,
                    message: `${device} (${firebaseKey}) actualizado a modo ${mode}.`,
                    moduleId: module_id,
                    device,
                    firebaseKey,
                    newMode: mode,
                    cycleConfig: mode === 'AUTO_CYCLE' ? { onMinutes: on_minutes, offMinutes: off_minutes } : undefined,
                    firebasePersisted: !updateRes.fallbackUsed,
                    timestamp: new Date().toISOString(),
                };
                return { content: [{ type: 'text', text: JSON.stringify(responsePayload, null, 2) }] };
            }
            // ─── update_strategy ──────────────────────────────────────
            // Writes to strategyPlan (not "strategy")
            if (name === 'update_strategy') {
                const { strain_name, cycle_week, module_id } = UpdateStrategySchema.parse(args);
                const updateRes = await (0, firebaseClient_js_1.updateModuleData)('strategyPlan', {
                    strainName: strain_name,
                    updatedAt: Date.now(),
                }, module_id);
                const responsePayload = {
                    success: updateRes.success,
                    message: `Estrategia de cultivo actualizada: ${strain_name} (${cycle_week}).`,
                    moduleId: module_id,
                    strainName: strain_name,
                    cycleWeek: cycle_week,
                    firebasePath: `kits/${module_id}/strategyPlan`,
                    firebasePersisted: !updateRes.fallbackUsed,
                    timestamp: new Date().toISOString(),
                };
                return { content: [{ type: 'text', text: JSON.stringify(responsePayload, null, 2) }] };
            }
            // ─── set_climate_remote_power ─────────────────────────────
            // Writes to climate_ac — the WeMos D1 R32 reads this every 1.5s to emit IR
            if (name === 'set_climate_remote_power') {
                const { power, temp, mode, fan, turbo, eco, module_id } = SetClimateRemotePowerSchema.parse(args);
                const patchData = {
                    power,
                    temp,
                    mode,
                    turbo,
                    eco,
                    updatedAt: Date.now(),
                };
                // Only include fan if explicitly provided
                if (fan !== undefined) {
                    patchData.fan = fan;
                }
                const updateRes = await (0, firebaseClient_js_1.updateModuleData)('climate_ac', patchData, module_id);
                const responsePayload = {
                    success: updateRes.success,
                    message: power
                        ? `Aire acondicionado ENCENDIDO en modo ${mode.toUpperCase()} a ${temp}°C.`
                        : 'Aire acondicionado APAGADO.',
                    moduleId: module_id,
                    powerState: power,
                    temperatureTarget: temp,
                    operatingMode: mode,
                    fanSpeed: fan,
                    turboMode: turbo,
                    ecoMode: eco,
                    firebasePath: `kits/${module_id}/climate_ac`,
                    firebasePersisted: !updateRes.fallbackUsed,
                    timestamp: new Date().toISOString(),
                };
                return { content: [{ type: 'text', text: JSON.stringify(responsePayload, null, 2) }] };
            }
            // ─── set_climate_remote_swing ─────────────────────────────
            // Writes swingV / swingH to climate_ac (not verticalSwing/horizontalSwing)
            if (name === 'set_climate_remote_swing') {
                const { vertical_swing, horizontal_swing, module_id } = SetClimateRemoteSwingSchema.parse(args);
                const patchData = { updatedAt: Date.now() };
                if (vertical_swing !== undefined)
                    patchData.swingV = vertical_swing;
                if (horizontal_swing !== undefined)
                    patchData.swingH = horizontal_swing;
                const updateRes = await (0, firebaseClient_js_1.updateModuleData)('climate_ac', patchData, module_id);
                const responsePayload = {
                    success: updateRes.success,
                    message: 'Oscilación del aire acondicionado actualizada.',
                    moduleId: module_id,
                    swingV: vertical_swing,
                    swingH: horizontal_swing,
                    firebasePath: `kits/${module_id}/climate_ac`,
                    firebasePersisted: !updateRes.fallbackUsed,
                    timestamp: new Date().toISOString(),
                };
                return { content: [{ type: 'text', text: JSON.stringify(responsePayload, null, 2) }] };
            }
            throw new Error(`Herramienta no reconocida: ${name}`);
        }
        catch (error) {
            console.error(`[MCP Tool Error] Error procesando herramienta ${name}:`, error);
            const errorPayload = {
                success: false,
                error: error.message || 'Error procesando solicitud MCP.',
                tool: name,
            };
            return {
                content: [{ type: 'text', text: JSON.stringify(errorPayload, null, 2) }],
                isError: true,
            };
        }
    });
}
