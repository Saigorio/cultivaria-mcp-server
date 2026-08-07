"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const tools_js_1 = require("./tools.js");
const resources_js_1 = require("./resources.js");
dotenv_1.default.config();
const PORT = Number(process.env.PORT) || 3001;
const app = (0, express_1.default)();
// 1. Full CORS — 100% Open for Gemini Spark
app.use((0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'mcp-session-id', 'Last-Event-ID'],
    exposedHeaders: ['mcp-session-id'],
    credentials: false,
}));
app.use(express_1.default.json());
// Logger middleware
app.use((req, res, next) => {
    console.log(`[MCP HTTP] ${req.method} ${req.originalUrl} - IP: ${req.ip} - Session: ${req.headers['mcp-session-id'] || 'none'}`);
    next();
});
const sessions = new Map();
/**
 * Creates a fresh MCP Server + StreamableHTTP Transport pair for a new session.
 */
function createSession() {
    const server = new index_js_1.Server({
        name: 'cultivaria-mcp-server',
        version: '1.0.0',
    }, {
        capabilities: {
            tools: {},
            resources: {},
        },
    });
    (0, tools_js_1.registerTools)(server);
    (0, resources_js_1.registerResources)(server);
    const transport = new streamableHttp_js_1.StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Let SDK generate session IDs
    });
    return { server, transport };
}
// ── Health Check ───────────────────────────────────────────────────
app.get('/health', (req, res) => {
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
app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    // Check if this is an initialization request (no session yet)
    const isInitialize = req.body?.method === 'initialize';
    if (isInitialize || !sessionId) {
        // New session: create server + transport, connect, and handle
        const session = createSession();
        await session.server.connect(session.transport);
        // handleRequest will generate a session ID and set it in the response header
        await session.transport.handleRequest(req, res, req.body);
        // Extract the session ID from the response header to store in our map
        const newSessionId = res.getHeader('mcp-session-id');
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
app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
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
    const session = sessions.get(sessionId);
    await session.transport.handleRequest(req, res);
});
// ── MCP Streamable HTTP Endpoint: DELETE /mcp ──────────────────────
// Session termination
app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    if (!sessionId || !sessions.has(sessionId)) {
        res.status(404).json({ error: 'Session not found' });
        return;
    }
    const session = sessions.get(sessionId);
    await session.transport.handleRequest(req, res);
    sessions.delete(sessionId);
    console.log(`[MCP] Session terminated by client: ${sessionId}`);
});
// ── HEAD handler for link checkers ─────────────────────────────────
app.head('*', (req, res) => {
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
