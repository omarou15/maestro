const WS_URL = process.env.NEXT_PUBLIC_BACKEND_WS || "wss://maestro-core.ocontact.fr/ws"

type EventHandler = (data: unknown) => void

class GatewayClient {
  private ws: WebSocket | null = null
  private handlers = new Map<string, Set<EventHandler>>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = 1000
  private maxReconnectDelay = 30000
  connected = false

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return

    try {
      this.ws = new WebSocket(WS_URL)

      this.ws.onopen = () => {
        this.connected = true
        this.reconnectDelay = 1000
        this.emit("_connected", true)
      }

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type) this.emit(msg.type, msg.data)
        } catch { /* ignore malformed */ }
      }

      this.ws.onclose = () => {
        this.connected = false
        this.emit("_connected", false)
        this.scheduleReconnect()
      }

      this.ws.onerror = () => {
        this.ws?.close()
      }
    } catch {
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, this.reconnectDelay)
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay)
  }

  on(event: string, handler: EventHandler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event)!.add(handler)
    return () => this.handlers.get(event)?.delete(handler)
  }

  private emit(event: string, data: unknown) {
    // Emit specific event handlers
    this.handlers.get(event)?.forEach(h => h(data))
    // Emit wildcard handlers
    this.handlers.get("*")?.forEach(h => h({ type: event, data }))
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
    this.connected = false
  }
}

// Singleton
let instance: GatewayClient | null = null

export function getGateway(): GatewayClient {
  if (!instance) {
    instance = new GatewayClient()
  }
  return instance
}
