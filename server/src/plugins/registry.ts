import type { Express } from "express"
import type { Plugin, PluginContext } from "./types.js"
import { fire, on } from "../hooks.js"

const plugins = new Map<string, Plugin>()

export async function registerPlugin(plugin: Plugin, app: Express): Promise<void> {
  if (plugins.has(plugin.id)) {
    console.warn(`[PLUGIN] ${plugin.id} déjà enregistré, ignoré`)
    return
  }

  const ctx: PluginContext = { app, fire, on }
  await plugin.register(ctx)
  plugins.set(plugin.id, plugin)
  console.log(`[PLUGIN] ${plugin.name} v${plugin.version} enregistré`)
}

export function getPlugins(): Plugin[] {
  return Array.from(plugins.values())
}

export function getPlugin(id: string): Plugin | undefined {
  return plugins.get(id)
}
