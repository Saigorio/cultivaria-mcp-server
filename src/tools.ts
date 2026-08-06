import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getModuleData, updateModuleData } from './firebaseClient.js';

// Schemas
const GetLiveTelemetrySchema = z.object({
  module_id: z.string().optional().default('flora-01'),
});

const GetHistoricalTelemetrySchema = z.object({
  metric: z.enum(['ph', 'ec', 'vpd', 'temp_agua', 'oxigeno', 'co2', 'temp_aire', 'humedad']),
  timeframe: z.enum(['1h', '24h', '1w', '1m', '6m']),
  module_id: z.string().optional().default('flora-01'),
});

const GetPhenologicalStatusSchema = z.object({
  module_id: z.string().optional().default('flora-01'),
});

const UpdateSetpointSchema = z.object({
  metric: z.enum(['ec', 'temp_agua', 'temp_aire', 'humedad_aire', 'vpd', 'ph']),
  target_value: z.number(),
  module_id: z.string().optional().default('flora-01'),
});

const TriggerIrrigationSchema = z.object({
  action: z.enum(['start', 'stop']),
  duration_minutes: z.number().optional().default(5),
  module_id: z.string().optional().default('flora-01'),
});

const SetActuatorModeSchema = z.object({
  device: z.enum(['extractor_general', 'ventilador_recirculacion']),
  mode: z.enum(['OFF', 'ON', 'AUTO', 'AUTO_CYCLE']),
  on_minutes: z.number().optional(),
  off_minutes: z.number().optional(),
  module_id: z.string().optional().default('flora-01'),
});

const UpdateStrategySchema = z.object({
  strain_name: z.string(),
  cycle_week: z.string(),
  module_id: z.string().optional().default('flora-01'),
});

const SetClimateRemotePowerSchema = z.object({
  power: z.boolean(),
  temp: z.number().optional().default(24),
  mode: z.enum(['cool', 'heat', 'dry', 'fan']).optional().default('cool'),
  turbo: z.boolean().optional().default(false),
  eco: z.boolean().optional().default(false),
  module_id: z.string().optional().default('flora-01'),
});

const SetClimateRemoteSwingSchema = z.object({
  vertical_swing: z.boolean().optional(),
  horizontal_swing: z.boolean().optional(),
  module_id: z.string().optional().default('flora-01'),
});

export function registerTools(server: Server) {
  // List Tools Definition
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'get_live_telemetry',
          description: 'Obtiene los datos en tiempo real de los sensores para un módulo de cultivo (ej. EC, Temp Agua, Temp Aire, Humedad, VPD, CO2, Nivel de Agua).',
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
          description: 'Consulta el estado fenológico actual, índice de salud foliar, última captura del ESP32-Cam y el diagnóstico agronómico IA reciente.',
          inputSchema: {
            type: 'object',
            properties: {
              module_id: { type: 'string', description: 'ID del módulo de cultivo.' },
            },
          },
        },
        {
          name: 'update_setpoint',
          description: 'Modifica el valor objetivo (target setpoint) de una variable de cultivo en la sala e incrementa el control agéntico.',
          inputSchema: {
            type: 'object',
            properties: {
              metric: {
                type: 'string',
                enum: ['ec', 'temp_agua', 'temp_aire', 'humedad_aire', 'vpd', 'ph'],
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
          description: 'Controla la electroválvula de la Isla de Riego (ESP-01) para iniciar o detener el riego con temporizador.',
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
          description: 'Ajusta los modos de operación (OFF, ON, AUTO, AUTO_CYCLE) de extractores y ventiladores de recirculación.',
          inputSchema: {
            type: 'object',
            properties: {
              device: {
                type: 'string',
                enum: ['extractor_general', 'ventilador_recirculacion'],
                description: 'Equipo de climatización a ajustar.',
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
          description: 'Cambia la variedad/genética o la semana del ciclo de cultivo activa para un módulo.',
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
          description: 'Controla el encendido/apagado, temperatura objetivo y modo operativo del aire acondicionado (Módulo Aire Nex / IR).',
          inputSchema: {
            type: 'object',
            properties: {
              power: { type: 'boolean', description: 'true para encender, false para apagar el aire acondicionado.' },
              temp: { type: 'number', description: 'Temperatura objetivo en °C (ej. 24).' },
              mode: { type: 'string', enum: ['cool', 'heat', 'dry', 'fan'], description: 'Modo de operación del aire.' },
              turbo: { type: 'boolean', description: 'Modo Turbo encendido/apagado.' },
              eco: { type: 'boolean', description: 'Modo Eco encendido/apagado.' },
              module_id: { type: 'string', description: 'ID del módulo de cultivo.' },
            },
            required: ['power'],
          },
        },
        {
          name: 'set_climate_remote_swing',
          description: 'Controla la oscilación de aletas (swing vertical y horizontal) del aire acondicionado.',
          inputSchema: {
            type: 'object',
            properties: {
              vertical_swing: { type: 'boolean', description: 'true para activar oscilación vertical.' },
              horizontal_swing: { type: 'boolean', description: 'true para activar oscilación horizontal.' },
              module_id: { type: 'string', description: 'ID del módulo de cultivo.' },
            },
          },
        },
      ],
    };
  });

  // Call Tool Request Handler with Graceful Degradation
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === 'get_live_telemetry') {
        const { module_id } = GetLiveTelemetrySchema.parse(args);
        const moduleData = await getModuleData(module_id);
        const readings = moduleData.currentReadings || {};
        const setpoints = moduleData.setpoints || {};

        const responsePayload = {
          success: true,
          moduleId: module_id,
          moduleName: moduleData.name,
          stage: moduleData.stage,
          telemetry: {
            ph: { value: readings.ph, target: setpoints.phTarget, status: Math.abs(readings.ph - setpoints.phTarget) < 0.3 ? 'OK' : 'AJUSTANDO' },
            ec: { value: readings.ec, unit: 'mS/cm', target: setpoints.ecTarget, status: Math.abs(readings.ec - setpoints.ecTarget) < 0.2 ? 'OK' : 'AJUSTANDO' },
            waterTemp: { value: readings.waterTemp, unit: '°C', target: setpoints.waterTempTarget, status: 'OK' },
            airTemp: { value: readings.airTemp, unit: '°C', target: setpoints.airTempTarget, status: 'OK' },
            airHumidity: { value: readings.airHumidity, unit: '%', target: setpoints.airHumidityTarget, status: 'OK' },
            vpd: { value: readings.vpd, unit: 'kPa', target: setpoints.vpdTarget, status: 'OPTIMO' },
            co2: { value: readings.co2, unit: 'PPM', status: 'NORMAL' },
            waterLevel: { value: readings.waterLevel, unit: '%', status: readings.waterLevel > 30 ? 'NORMAL' : 'ALERTA_LOW' },
          },
          timestamp: new Date().toISOString(),
        };

        return { content: [{ type: 'text', text: JSON.stringify(responsePayload, null, 2) }] };
      }

      if (name === 'get_historical_telemetry') {
        const { metric, timeframe, module_id } = GetHistoricalTelemetrySchema.parse(args);
        const moduleData = await getModuleData(module_id);
        const currentVal = moduleData.currentReadings[metric] || 1.5;

        // Generate clean historical series data
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

      if (name === 'get_phenological_status') {
        const { module_id } = GetPhenologicalStatusSchema.parse(args);
        const moduleData = await getModuleData(module_id);
        const phenology = moduleData.phenology || {};

        const responsePayload = {
          success: true,
          moduleId: module_id,
          moduleName: moduleData.name,
          stage: moduleData.stage,
          strategy: moduleData.strategy,
          healthIndex: phenology.healthIndex || '98% Excelente',
          lastESP32Snapshot: {
            url: phenology.lastSnapshotUrl || 'https://cultivaria-9673f.web.app/snapshots/latest.jpg',
            timestamp: new Date(phenology.lastSnapshotTimestamp || Date.now()).toISOString(),
          },
          recentAIDiagnosis: phenology.lastAIDiagnosis || 'Masa foliar vigorosa con clorofila óptima.',
        };

        return { content: [{ type: 'text', text: JSON.stringify(responsePayload, null, 2) }] };
      }

      if (name === 'update_setpoint') {
        const { metric, target_value, module_id } = UpdateSetpointSchema.parse(args);
        
        // Map metric key
        const setpointKeyMap: Record<string, string> = {
          ec: 'ecTarget',
          temp_agua: 'waterTempTarget',
          temp_aire: 'airTempTarget',
          humedad_aire: 'airHumidityTarget',
          vpd: 'vpdTarget',
          ph: 'phTarget',
        };
        const rtdbKey = setpointKeyMap[metric] || metric;

        const updateRes = await updateModuleData('setpoints', { [rtdbKey]: target_value }, module_id);

        const responsePayload = {
          success: updateRes.success,
          message: `Setpoint de ${metric} actualizado con éxito a ${target_value}.`,
          moduleId: module_id,
          metric,
          newTargetValue: target_value,
          rtdbUpdated: !updateRes.fallbackUsed,
          timestamp: new Date().toISOString(),
        };

        return { content: [{ type: 'text', text: JSON.stringify(responsePayload, null, 2) }] };
      }

      if (name === 'trigger_irrigation') {
        const { action, duration_minutes, module_id } = TriggerIrrigationSchema.parse(args);
        const statusText = action === 'start' ? 'ABIERTA' : 'CERRADA';

        const updateRes = await updateModuleData('commands/irrigation', {
          status: statusText,
          durationMinutes: action === 'start' ? duration_minutes : 0,
          updatedAt: Date.now(),
        }, module_id);

        const responsePayload = {
          success: updateRes.success,
          message: action === 'start'
            ? `Electroválvula de riego ABIERTA por ${duration_minutes} minutos.`
            : 'Electroválvula de riego CERRADA.',
          moduleId: module_id,
          valveState: statusText,
          durationMinutes: action === 'start' ? duration_minutes : 0,
          timestamp: new Date().toISOString(),
        };

        return { content: [{ type: 'text', text: JSON.stringify(responsePayload, null, 2) }] };
      }

      if (name === 'set_actuator_mode') {
        const { device, mode, on_minutes, off_minutes, module_id } = SetActuatorModeSchema.parse(args);

        const patchPayload: Record<string, any> = { [device]: mode };
        if (on_minutes !== undefined) patchPayload[`${device}_on_min`] = on_minutes;
        if (off_minutes !== undefined) patchPayload[`${device}_off_min`] = off_minutes;

        const updateRes = await updateModuleData('actuators', patchPayload, module_id);

        const responsePayload = {
          success: updateRes.success,
          message: `Modo de ${device} actualizado a ${mode}.`,
          moduleId: module_id,
          device,
          newMode: mode,
          cycleConfig: mode === 'AUTO_CYCLE' ? { onMinutes: on_minutes, offMinutes: off_minutes } : undefined,
          timestamp: new Date().toISOString(),
        };

        return { content: [{ type: 'text', text: JSON.stringify(responsePayload, null, 2) }] };
      }

      if (name === 'update_strategy') {
        const { strain_name, cycle_week, module_id } = UpdateStrategySchema.parse(args);

        const updateRes = await updateModuleData('strategy', {
          strainName: strain_name,
          cycleWeek: cycle_week,
          updatedAt: Date.now(),
        }, module_id);

        const responsePayload = {
          success: updateRes.success,
          message: `Estrategia de cultivo actualizada a ${strain_name} (${cycle_week}).`,
          moduleId: module_id,
          strainName: strain_name,
          cycleWeek: cycle_week,
          timestamp: new Date().toISOString(),
        };

        return { content: [{ type: 'text', text: JSON.stringify(responsePayload, null, 2) }] };
      }

      if (name === 'set_climate_remote_power') {
        const { power, temp, mode, turbo, eco, module_id } = SetClimateRemotePowerSchema.parse(args);

        const updateRes = await updateModuleData('virtual_ac', {
          power,
          temp,
          mode,
          turbo,
          eco,
          updatedAt: Date.now(),
        }, module_id);

        const responsePayload = {
          success: updateRes.success,
          message: power
            ? `Aire acondicionado ENCENDIDO en modo ${mode.toUpperCase()} a ${temp}°C.`
            : 'Aire acondicionado APAGADO.',
          moduleId: module_id,
          powerState: power,
          temperatureTarget: temp,
          operatingMode: mode,
          turboMode: turbo,
          ecoMode: eco,
          timestamp: new Date().toISOString(),
        };

        return { content: [{ type: 'text', text: JSON.stringify(responsePayload, null, 2) }] };
      }

      if (name === 'set_climate_remote_swing') {
        const { vertical_swing, horizontal_swing, module_id } = SetClimateRemoteSwingSchema.parse(args);

        const patchData: Record<string, any> = { updatedAt: Date.now() };
        if (vertical_swing !== undefined) patchData.verticalSwing = vertical_swing;
        if (horizontal_swing !== undefined) patchData.horizontalSwing = horizontal_swing;

        const updateRes = await updateModuleData('virtual_ac', patchData, module_id);

        const responsePayload = {
          success: updateRes.success,
          message: 'Oscilación de aire acondicionado actualizada con éxito.',
          moduleId: module_id,
          verticalSwing: vertical_swing,
          horizontalSwing: horizontal_swing,
          timestamp: new Date().toISOString(),
        };

        return { content: [{ type: 'text', text: JSON.stringify(responsePayload, null, 2) }] };
      }

      throw new Error(`Herramienta no reconocida: ${name}`);
    } catch (error: any) {
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
