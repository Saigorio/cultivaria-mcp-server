"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const sse_js_1 = require("@modelcontextprotocol/sdk/server/sse.js");
const tools_js_1 = require("./tools.js");
const resources_js_1 = require("./resources.js");
dotenv_1.default.config();
const PORT = Number(process.env.PORT) || 3001;
const CULTIVARIA_MCP_TOKEN = process.env.CULTIVARIA_MCP_TOKEN || 'cultivaria_mcp_secret_token_2026';
const app = (0, express_1.default)();
// 1. CORS Middleware for Cross-Origin requests
app.use((0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
}));
app.use(express_1.default.json());
// 2. Open / Public Middleware
function authenticateBearer(req, res, next) {
    next();
}
// 3. Initialize MCP Server Instance
const server = new index_js_1.Server({
    name: 'cultivaria-mcp-server',
    version: '1.0.0',
}, {
    capabilities: {
        tools: {},
        resources: {},
    },
});
// Register Tools & Resources
(0, tools_js_1.registerTools)(server);
(0, resources_js_1.registerResources)(server);
// Map to store active SSE transports per session
const transports = new Map();
// HEAD request handler for link checkers
app.head('*', (req, res) => {
    res.status(200).end();
});
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ONLINE',
        server: 'CultivarIA MCP Server',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    });
});
// SSE Connection Endpoint - Supports '/', '/sse', '/mcp', '/api/mcp'
app.get(['/', '/sse', '/mcp', '/api/mcp'], authenticateBearer, async (req, res) => {
    console.log(`[MCP SSE] Cliente (${req.ip}) conectado iniciando SSE stream en ${req.path}...`);
    const transport = new sse_js_1.SSEServerTransport('/messages', res);
    transports.set(transport.sessionId, transport);
    req.on('close', () => {
        console.log(`[MCP SSE] Sesión cerrada: ${transport.sessionId}`);
        transports.delete(transport.sessionId);
    });
    await server.connect(transport);
});
// SSE Message Posting Endpoint
app.post('/messages', authenticateBearer, async (req, res) => {
    const sessionId = req.query.sessionId;
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
