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
    methods: ['GET', 'POST', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  })
);

app.use(express.json());

// 2. Open / Public Middleware
function authenticateBearer(req: Request, res: Response, next: NextFunction) {
  next();
}

// 3. Initialize MCP Server Instance
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
  const transport = new SSEServerTransport('/messages', res);
  transports.set(transport.sessionId, transport);

  req.on('close', () => {
    console.log(`[MCP SSE] Sesión cerrada: ${transport.sessionId}`);
    transports.delete(transport.sessionId);
  });

  await server.connect(transport);
});

// SSE Message Posting Endpoint
app.post('/messages', authenticateBearer, async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) {
    res.status(400).json({ success: false, error: 'Se requiere el parámetro sessionId en la URL.' });
    return;
  }

  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(404).json({ success: false, error: 'Sesión SSE no encontrada o expirada.' });
    return;
  }

  await transport.handlePostMessage(req, res);
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
🔑 Token de Acceso:   Authorization: Bearer ${CULTIVARIA_MCP_TOKEN}
===========================================================
`);
});
