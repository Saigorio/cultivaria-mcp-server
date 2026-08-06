import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { registerTools } from './tools.js';
import { registerResources } from './resources.js';

dotenv.config();

const PORT = Number(process.env.PORT) || 3001;
const CULTIVARIA_MCP_TOKEN = process.env.CULTIVARIA_MCP_TOKEN || 'cultivaria_mcp_secret_token_2026';

const app = express();

// 1. CORS Middleware for Cross-Origin requests
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS', 'HEAD', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  })
);

app.use(express.json());

// Logger middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[MCP HTTP] ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  next();
});

// Open / Public Middleware
function authenticateBearer(req: Request, res: Response, next: NextFunction) {
  next();
}

// Initialize MCP Server Instance
const server = new Server(
  {
    name: 'cultivaria-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Register Tools & Resources
registerTools(server);
registerResources(server);

// Map to store active SSE transports per session
const transports = new Map<string, SSEServerTransport>();

// HEAD request handler for link checkers
app.head('*', (req: Request, res: Response) => {
  res.status(200).end();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ONLINE',
    server: 'CultivarIA MCP Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// SSE Connection Endpoint - Supports '/', '/sse', '/mcp', '/api/mcp'
app.get(['/', '/sse', '/mcp', '/api/mcp'], authenticateBearer, async (req: Request, res: Response) => {
  console.log(`[MCP SSE] Cliente (${req.ip}) conectado iniciando SSE stream en ${req.path}...`);
  
  const host = req.get('host') || 'cultivaria-mcp-server.onrender.com';
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
  const messageEndpoint = `${protocol}://${host}/messages`;

  const transport = new SSEServerTransport(messageEndpoint, res);
  transports.set(transport.sessionId, transport);

  req.on('close', () => {
    console.log(`[MCP SSE] Sesión cerrada: ${transport.sessionId}`);
    transports.delete(transport.sessionId);
  });

  await server.connect(transport);
});

// Dual HTTP POST / JSON-RPC Handler for direct MCP clients
app.post(['/', '/sse', '/mcp', '/api/mcp', '/messages'], authenticateBearer, async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;

  // Handle SSE Post Messages if sessionId exists
  if (sessionId && transports.has(sessionId)) {
    const transport = transports.get(sessionId);
    await transport!.handlePostMessage(req, res);
    return;
  }

  // Handle direct JSON-RPC Requests (for clients querying without SSE session)
  const body = req.body;
  if (body && typeof body === 'object' && body.jsonrpc === '2.0') {
    const { id, method } = body;

    if (method === 'initialize') {
      res.json({
        jsonrpc: '2.0',
        id: id || 1,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {},
          },
          serverInfo: {
            name: 'cultivaria-mcp-server',
            version: '1.0.0',
          },
        },
      });
      return;
    }

    if (method === 'notifications/initialized') {
      res.status(200).end();
      return;
    }

    if (method === 'tools/list') {
      res.json({
        jsonrpc: '2.0',
        id: id || 1,
        result: {
          tools: [
            {
              name: 'get_live_telemetry',
              description: 'Obtiene los datos en tiempo real de los sensores para un módulo de cultivo (ej. EC, Temp Agua, Temp Aire, Humedad, VPD, CO2, Nivel de Agua).',
            },
            {
              name: 'get_historical_telemetry',
              description: 'Consulta el historial de mediciones para análisis de tendencias de una métrica agronómica en un rango temporal.',
            },
            {
              name: 'get_phenological_status',
              description: 'Consulta el estado fenológico actual, índice de salud foliar, última captura del ESP32-Cam y el diagnóstico agronómico IA reciente.',
            },
            {
              name: 'update_setpoint',
              description: 'Modifica el valor objetivo (target setpoint) de una variable de cultivo en la sala e incrementa el control agéntico.',
            },
            {
              name: 'trigger_irrigation',
              description: 'Controla la electroválvula de la Isla de Riego (ESP-01) para iniciar o detener el riego con temporizador.',
            },
            {
              name: 'set_actuator_mode',
              description: 'Ajusta los modos de operación (OFF, ON, AUTO, AUTO_CYCLE) de extractores y ventiladores de recirculación.',
            },
            {
              name: 'set_climate_remote_power',
              description: 'Controla el encendido/apagado, temperatura objetivo y modo operativo del aire acondicionado (Módulo Aire Nex / IR).',
            },
            {
              name: 'set_climate_remote_swing',
              description: 'Controla la oscilación de aletas (swing vertical y horizontal) del aire acondicionado.',
            },
            {
              name: 'update_strategy',
              description: 'Cambia la variedad/genética o la semana del ciclo de cultivo activa para un módulo.',
            },
          ],
        },
      });
      return;
    }

    if (method === 'resources/list') {
      res.json({
        jsonrpc: '2.0',
        id: id || 1,
        result: {
          resources: [
            {
              uri: 'cultivaria://system_status',
              name: 'Resumen de Estado del Sistema CultivarIA',
              mimeType: 'application/json',
            },
            {
              uri: 'cultivaria://modules',
              name: 'Módulos de Cultivo Registrados',
              mimeType: 'application/json',
            },
          ],
        },
      });
      return;
    }
  }

  // Fallback response for empty POST or generic pings
  res.status(200).json({
    status: 'ONLINE',
    server: 'CultivarIA MCP Server',
    sseEndpoint: '/sse',
  });
});

// Start Express Listener
app.listen(PORT, () => {
  console.log(`
===========================================================
🚀 SERVIDOR MCP CULTIVARIA INICIADO EXITOSAMENTE
===========================================================
📡 Endpoint SSE:      http://localhost:${PORT}/sse
📩 Endpoint Mensajes: http://localhost:${PORT}/messages
🏥 Health Check:     http://localhost:${PORT}/health
===========================================================
`);
});
