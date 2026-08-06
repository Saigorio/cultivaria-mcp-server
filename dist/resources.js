"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerResources = registerResources;
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const firebaseClient_js_1 = require("./firebaseClient.js");
function registerResources(server) {
    // List Resources Definition
    server.setRequestHandler(types_js_1.ListResourcesRequestSchema, async () => {
        return {
            resources: [
                {
                    uri: 'cultivaria://system_status',
                    name: 'Resumen de Estado del Sistema CultivarIA',
                    mimeType: 'application/json',
                    description: 'Resumen del estado general de la plataforma, salud de nodos ESP32, alertas activas y estrategia.',
                },
                {
                    uri: 'cultivaria://modules',
                    name: 'Módulos de Cultivo Registrados',
                    mimeType: 'application/json',
                    description: 'Lista completa de salas y módulos de cultivo con sus identificadores y estado actual de sensores.',
                },
            ],
        };
    });
    // Read Resource Request Handler
    server.setRequestHandler(types_js_1.ReadResourceRequestSchema, async (request) => {
        const uri = request.params.uri;
        if (uri === 'cultivaria://system_status') {
            const moduleData = await (0, firebaseClient_js_1.getModuleData)('flora-01');
            const statusPayload = {
                systemName: 'CultivarIA Automation Platform',
                version: '2.5.0-agronomist-ai',
                status: 'OPERATING_NORMAL',
                esp32Nodes: {
                    'ESP-01 (Isla de Riego)': { status: 'ONLINE', rssi: '-62 dBm', uptime: '14d 6h' },
                    'ESP32-Cam (Visión Foliares)': { status: 'ONLINE', rssi: '-58 dBm', uptime: '7d 12h' },
                    'ESP32-HVAC (Climatización & IR)': { status: 'ONLINE', rssi: '-65 dBm', uptime: '14d 6h' },
                },
                activeStrategy: moduleData.strategy,
                activeAlerts: [],
                timestamp: new Date().toISOString(),
            };
            return {
                contents: [
                    {
                        uri,
                        mimeType: 'application/json',
                        text: JSON.stringify(statusPayload, null, 2),
                    },
                ],
            };
        }
        if (uri === 'cultivaria://modules') {
            const moduleData = await (0, firebaseClient_js_1.getModuleData)('flora-01');
            const modulesPayload = [
                {
                    id: moduleData.id,
                    name: moduleData.name,
                    stage: moduleData.stage,
                    sensorStatus: 'OK',
                    readingsSummary: {
                        ph: moduleData.currentReadings.ph,
                        ec: moduleData.currentReadings.ec,
                        airTemp: moduleData.currentReadings.airTemp,
                        vpd: moduleData.currentReadings.vpd,
                    },
                },
            ];
            return {
                contents: [
                    {
                        uri,
                        mimeType: 'application/json',
                        text: JSON.stringify(modulesPayload, null, 2),
                    },
                ],
            };
        }
        throw new Error(`Recurso no encontrado: ${uri}`);
    });
}
