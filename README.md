# CultivarIA - Servidor MCP (Model Context Protocol)

Servidor **MCP (Model Context Protocol)** oficial para la plataforma **CultivarIA** ([https://cultivaria-9673f.web.app/](https://cultivaria-9673f.web.app/)).

Este servidor expone **Herramientas (Tools)** y **Recursos (Resources)** estandarizados a través de transporte **HTTP con SSE (Server-Sent Events)** para permitir que asistentes de Inteligencia Artificial (como **Gemini Spark**, Antigravity, Claude, etc.) consulten telemetría en tiempo real, analicen tendencias históricas y ejecuten comandos de control sobre módulos y actuadores de cultivo.

---

## 1. Requisitos Previos

- **Node.js**: v18.0.0 o superior.
- **npm**: v9.0.0 o superior.

---

## 2. Instalación y Compilación

1. Ingresa a la carpeta del servidor MCP:
   ```bash
   cd mcp-server
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Compila el código TypeScript a JavaScript en `./dist`:
   ```bash
   npm run build
   ```

4. Inicia el servidor en modo producción:
   ```bash
   npm start
   ```

5. (Opcional) Inicia en modo desarrollo con auto-recarga:
   ```bash
   npm run dev
   ```

---

## 3. Variables de Entorno (`.env`)

Crea un archivo `.env` en la raíz de `mcp-server/` basado en `.env.example`:

```env
PORT=3001
CULTIVARIA_MCP_TOKEN=cultivaria_mcp_secret_token_2026
BACKEND_URL=https://cultivaria-9673f-default-rtdb.firebaseio.com
```

---

## 4. Configuración del Conector para Clientes MCP (Gemini Spark / Antigravity / Claude)

### Conexión HTTP / SSE (Remota o Local)

Agrega la siguiente configuración en la sección de MCP Servers de tu cliente o entorno:

```json
{
  "mcpServers": {
    "cultivaria": {
      "url": "http://localhost:3001/sse",
      "headers": {
        "Authorization": "Bearer cultivaria_mcp_secret_token_2026"
      }
    }
  }
}
```

---

## 5. Despliegue 24/7 en la Nube de Google (Google Cloud Run)

Para alojar el servidor MCP encendido **las 24 horas del día en la infraestructura global de Google**:

1. Ve al panel de Google Cloud: **[Google Cloud Run Console](https://console.cloud.google.com/run?project=cultivaria-9673f)**.
2. Haz clic en el botón **"Crear Servicio"** (Create Service).
3. Conecta tu repositorio de GitHub o suba la carpeta `mcp-server` con el **`Dockerfile`** optimizado incluido.
4. En la pestaña **Variables de entorno y secreto**, agrega:
   - `CULTIVARIA_MCP_TOKEN` = `cultivaria_mcp_secret_token_2026`
   - `BACKEND_URL` = `https://cultivaria-9673f-default-rtdb.firebaseio.com`
5. En **Ingreso / Autenticación**, marca **"Permitir peticiones sin autenticar"** (la autenticación de seguridad es manejada internamente por el Bearer Token del MCP).
6. Al hacer clic en **Crear**, Google te asignará una URL pública HTTPS permanente de 24/7 (ejemplo: `https://cultivaria-mcp-server-xyz-uc.a.run.app`).

---

## 6. Alternativa Gratuita 24/7 en Render.com

Si deseas una opción 24/7 de 1 solo clic en una nube gratuita:

1. Ve a **[render.com](https://render.com/)** y crea un **Web Service** gratuito conectando este repositorio.
2. Render detectará automáticamente el archivo `render.yaml` incluido en `mcp-server/`.
3. Obtendrás una URL pública de 24/7 como `https://cultivaria-mcp-server.onrender.com/sse`.

---

## 7. Exposición Remota Temporal para Desarrollo (Túnel con ngrok)

Para permitir que **Gemini Spark** o cualquier cliente MCP remoto se conecte a tu servidor MCP local mientras desarrollas:

1. Ejecuta el comando de túnel incluido:
   ```bash
   npm run tunnel
   ```
   *(O usa `npx ngrok http 3001` directamente)*.

2. Obtendrás una URL pública segura (ej. `https://a1b2-34-56-78-90.ngrok-free.app`).

3. Actualiza la URL en tu cliente MCP:
   ```json
   {
     "mcpServers": {
       "cultivaria": {
         "url": "https://a1b2-34-56-78-90.ngrok-free.app/sse",
         "headers": {
           "Authorization": "Bearer cultivaria_mcp_secret_token_2026"
         }
       }
     }
   }
   ```

---

## 6. Ejemplos de Prueba con cURL y Postman

### A. Health Check
```bash
curl http://localhost:3001/health
```
**Respuesta:** `{"status":"ONLINE","server":"CultivarIA MCP Server","version":"1.0.0"}`

---

### B. Iniciar Conexión SSE (Requiere Token Bearer)
```bash
curl -i -N \
  -H "Authorization: Bearer cultivaria_mcp_secret_token_2026" \
  http://localhost:3001/sse
```
*Si no envías el token, el servidor responderá `401 Unauthorized`.*

---

### C. Probar Invocación de Herramienta por POST (JSON-RPC)
Envía un mensaje JSON-RPC al endpoint `/messages?sessionId=<SESSION_ID>` retornado en el evento SSE `endpoint`:

```bash
curl -X POST \
  "http://localhost:3001/messages?sessionId=<SESSION_ID>" \
  -H "Authorization: Bearer cultivaria_mcp_secret_token_2026" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_live_telemetry",
      "arguments": {
        "module_id": "flora-01"
      }
    }
  }'
```

---

## 7. Catálogo de Herramientas (MCP Tools)

| Herramienta | Descripción | Parámetros Clave |
| :--- | :--- | :--- |
| `get_live_telemetry` | Lecturas de sensores en vivo | `module_id` |
| `get_historical_telemetry` | Serie de tiempo e historial de tendencias | `metric`, `timeframe`, `module_id` |
| `get_phenological_status` | Salud vegetal y capturas ESP32 | `module_id` |
| `update_setpoint` | Actualiza metas de pH, EC, Temp, VPD | `metric`, `target_value`, `module_id` |
| `trigger_irrigation` | Controla electroválvula de riego | `action` (`start`/`stop`), `duration_minutes` |
| `set_actuator_mode` | Ajusta modos de climatización | `device`, `mode`, `on_minutes`, `off_minutes` |
| `update_strategy` | Cambia variedad y semana de cultivo | `strain_name`, `cycle_week` |

---

## 8. Recursos MCP (MCP Resources)

- `cultivaria://system_status`: Resumen del sistema, salud de nodos ESP32 y alertas.
- `cultivaria://modules`: Módulos de cultivo registrados y resumen de sensores.
