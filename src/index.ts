import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerTools } from './tools.js';
import { registerResources } from './resources.js';

dotenv.config();

const PORT = Number(process.env.PORT) || 3001;

const app = express();

// 1. Full CORS — 100% Open for Gemini Spark
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'mcp-session-id', 'Last-Event-ID'],
  exposedHeaders: ['mcp-session-id'],
  credentials: false,
}));

app.use(express.json());

// Logger middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[MCP HTTP] ${req.method} ${req.originalUrl} - IP: ${req.ip} - Session: ${req.headers['mcp-session-id'] || 'none'}`);
  next();
});

// ── Session Management ─────────────────────────────────────────────
interface McpSession {
  server: Server;
  transport: StreamableHTTPServerTransport;
}

const sessions = new Map<string, McpSession>();

/**
 * Creates a fresh MCP Server + StreamableHTTP Transport pair for a new session.
 */
function createSession(): McpSession {
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
  registerTools(server);
  registerResources(server);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Let SDK generate session IDs
  });

  return { server, transport };
}

// ── Health Check ───────────────────────────────────────────────────
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ONLINE',
    server: 'CultivarIA MCP Server',
    version: '1.0.0',
    transport: 'streamable-http',
    activeSessions: sessions.size,
    timestamp: new Date().toISOString(),
  });
});

// ── MCP Streamable HTTP Endpoint: POST /mcp ────────────────────────
// Handles all JSON-RPC requests from MCP clients
app.post('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  // Check if this is an initialization request (no session yet)
  const isInitialize = req.body?.method === 'initialize';

  if (isInitialize || !sessionId) {
    // New session: create server + transport, connect, and handle
    const session = createSession();

    await session.server.connect(session.transport);

    // handleRequest will generate a session ID and set it in the response header
    await session.transport.handleRequest(req, res, req.body);

    // Extract the session ID from the response header to store in our map
    const newSessionId = res.getHeader('mcp-session-id') as string;
    if (newSessionId) {
      sessions.set(newSessionId, session);
      console.log(`[MCP] New session created: ${newSessionId}`);

      // Clean up when transport closes
      session.transport.onclose = () => {
        sessions.delete(newSessionId);
        console.log(`[MCP] Session closed: ${newSessionId}`);
      };
    }
    return;
  }

  // Existing session: route to the correct transport
  const session = sessions.get(sessionId);
  if (!session) {
    res.status(404).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: `Session not found: ${sessionId}. Send an 'initialize' request first.`,
      },
      id: null,
    });
    return;
  }

  await session.transport.handleRequest(req, res, req.body);
});

// ── MCP Streamable HTTP Endpoint: GET /mcp ─────────────────────────
// Server-Sent Events stream for server-to-client notifications
app.get('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Missing or invalid mcp-session-id header. Initialize a session first via POST /mcp.',
      },
      id: null,
    });
    return;
  }

  const session = sessions.get(sessionId)!;
  await session.transport.handleRequest(req, res);
});

// ── MCP Streamable HTTP Endpoint: DELETE /mcp ──────────────────────
// Session termination
app.delete('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !sessions.has(sessionId)) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const session = sessions.get(sessionId)!;
  await session.transport.handleRequest(req, res);
  sessions.delete(sessionId);
  console.log(`[MCP] Session terminated by client: ${sessionId}`);
});

// ── HEAD handler for link checkers ─────────────────────────────────
app.head('*', (req: Request, res: Response) => {
  res.status(200).end();
});

// ── Start Express Listener ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
===========================================================
🚀 SERVIDOR MCP CULTIVARIA (Streamable HTTP Transport)
===========================================================
📡 MCP Endpoint:     http://localhost:${PORT}/mcp
🏥 Health Check:     http://localhost:${PORT}/health
🔓 Auth:             NONE (100% Public & Open CORS)
===========================================================
`);
});
