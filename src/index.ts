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

// MCP Manifest payload for Gemini Spark / Custom Connected App link validators
const getMcpManifest = (req: Request) => {
  const host = req.get('host') || 'cultivaria-mcp-server.onrender.com';
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
  const baseUrl = `${protocol}://${host}`;

  return {
    schema_version: 'v1',
    name_for_human: 'CultivarIA MCP Server',
    name_for_model: 'cultivaria',
    description_for_human: 'Plataforma de automatización agronómica y control agéntico para cultivo indoor e hidropónico.',
    description_for_model: 'Servidor MCP para consultar telemetría en tiempo real y ejecutar acciones de control sobre salas de cultivo CultivarIA.',
    auth: {
      type: 'none',
    },
    api: {
      type: 'sse',
      url: `${baseUrl}/sse`,
      has_user_authentication: false,
    },
    mcpServers: {
      cultivaria: {
        url: `${baseUrl}/sse`,
      },
    },
    tools: [
      { name: 'get_live_telemetry', description: 'Obtiene los datos en tiempo real de los sensores' },
      { name: 'get_historical_telemetry', description: 'Consulta el historial de mediciones' },
      { name: 'get_phenological_status', description: 'Consulta el estado fenológico actual y captura ESP32' },
      { name: 'update_setpoint', description: 'Modifica el valor objetivo de variables de cultivo' },
      { name: 'trigger_irrigation', description: 'Controla la electroválvula de riego' },
      { name: 'set_actuator_mode', description: 'Ajusta modos de extractores y ventiladores' },
      { name: 'set_climate_remote_power', description: 'Control de encendido/apagado y temperatura del aire acondicionado' },
      { name: 'set_climate_remote_swing', description: 'Control de oscilación de aletas del aire acondicionado' },
      { name: 'update_strategy', description: 'Cambia la variedad y semana del ciclo de cultivo' },
    ],
  };
};

// HEAD request handler for link checkers
app.head('*', (req: Request, res: Response) => {
  res.status(200).end();
});

// Well-known MCP Manifest Endpoints for Google Gemini Spark Link Discovery
app.get(
  ['/.well-known/mcp.json', '/.well-known/mcp', '/mcp.json', '/manifest.json'],
  (req: Request, res: Response) => {
    res.json(getMcpManifest(req));
  }
);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ONLINE',
    server: 'CultivarIA MCP Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Smart Root / SSE Connection Endpoint
app.get(['/', '/sse', '/mcp', '/api/mcp'], authenticateBearer, async (req: Request, res: Response) => {
  const acceptHeader = req.headers.accept || '';

  // If request comes from an HTTP validator / browser expecting JSON (and not requesting SSE event-stream)
  if (req.path === '/' && !acceptHeader.includes('text/event-stream')) {
    res.json(getMcpManifest(req));
    return;
  }

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
            { name: 'get_live_telemetry', description: 'Obtiene los datos en tiempo real de los sensores' },
            { name: 'get_historical_telemetry', description: 'Consulta el historial de mediciones' },
            { name: 'get_phenological_status', description: 'Consulta el estado fenológico actual y captura ESP32' },
            { name: 'update_setpoint', description: 'Modifica el valor objetivo de variables de cultivo' },
            { name: 'trigger_irrigation', description: 'Controla la electroválvula de riego' },
            { name: 'set_actuator_mode', description: 'Ajusta modos de extractores y ventiladores' },
            { name: 'set_climate_remote_power', description: 'Control de encendido/apagado y temperatura del aire acondicionado' },
            { name: 'set_climate_remote_swing', description: 'Control de oscilación de aletas del aire acondicionado' },
            { name: 'update_strategy', description: 'Cambia la variedad y semana del ciclo de cultivo' },
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
  res.status(200).json(getMcpManifest(req));
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
