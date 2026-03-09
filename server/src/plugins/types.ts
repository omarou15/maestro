import type { Express } from "express"

export type PluginContext = {
  app: Express
  fire: (event: string, data?: unknown) => Promise<void>
  on: (event: string, handler: (data: unknown) => void | Promise<void>) => void
}

export type Plugin = {
  id: string
  name: string
  version: string
  register: (ctx: PluginContext) => void | Promise<void>
}
