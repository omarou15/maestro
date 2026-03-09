import { emit } from "./gateway.js"

type HookHandler = (data: unknown) => void | Promise<void>

const registry = new Map<string, HookHandler[]>()

export function on(event: string, handler: HookHandler): void {
  if (!registry.has(event)) registry.set(event, [])
  registry.get(event)!.push(handler)
}

export function off(event: string, handler: HookHandler): void {
  const handlers = registry.get(event)
  if (!handlers) return
  const idx = handlers.indexOf(handler)
  if (idx !== -1) handlers.splice(idx, 1)
}

export async function fire(event: string, data?: unknown): Promise<void> {
  // Broadcast to WebSocket clients
  emit(event, data)

  // Run registered handlers
  const handlers = registry.get(event)
  if (!handlers || handlers.length === 0) return
  await Promise.allSettled(handlers.map(h => h(data)))
}

// All event types for type-safety reference
export const EVENTS = {
  // Missions
  MISSION_CREATED: "mission:created",
  MISSION_UPDATED: "mission:updated",
  MISSION_DELETED: "mission:deleted",
  // Agents
  AGENT_STARTED: "agent:started",
  AGENT_COMPLETED: "agent:completed",
  AGENT_ERROR: "agent:error",
  // Approvals
  APPROVAL_NEEDED: "approval:needed",
  APPROVAL_RESOLVED: "approval:resolved",
  // Crons
  CRON_RUN: "cron:run",
  CRON_UPDATED: "cron:updated",
  // System
  HEARTBEAT: "system:heartbeat",
  SELF_HEAL: "system:self-heal",
  CHAT_MESSAGE: "chat:message",
  // Activity
  ACTIVITY: "activity",
} as const
