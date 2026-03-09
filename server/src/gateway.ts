import { WebSocketServer, WebSocket } from "ws"
import type { Server } from "http"

export type GatewayEvent = {
  type: string
  data?: unknown
  timestamp: string
}

const clients = new Set<WebSocket>()

let wss: WebSocketServer | null = null

export function initGateway(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: "/ws" })

  wss.on("connection", (ws) => {
    clients.add(ws)
    console.log(`[WS] Client connecté (${clients.size} total)`)

    // Send initial state on connect
    ws.send(JSON.stringify({
      type: "connected",
      data: { clients: clients.size },
      timestamp: new Date().toISOString(),
    }))

    ws.on("close", () => {
      clients.delete(ws)
      console.log(`[WS] Client déconnecté (${clients.size} total)`)
    })

    ws.on("error", () => {
      clients.delete(ws)
    })
  })

  console.log("[WS] Gateway WebSocket initialisée sur /ws")
  return wss
}

export function broadcast(event: GatewayEvent): void {
  if (clients.size === 0) return
  const msg = JSON.stringify(event)
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg)
    }
  }
}

export function emit(type: string, data?: unknown): void {
  broadcast({
    type,
    data,
    timestamp: new Date().toISOString(),
  })
}

export function getConnectedClients(): number {
  return clients.size
}
