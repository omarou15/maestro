"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { getGateway } from "@/lib/gateway"

export function useGateway() {
  const [connected, setConnected] = useState(false)
  const gatewayRef = useRef(getGateway())

  useEffect(() => {
    const gw = gatewayRef.current
    gw.connect()

    const off = gw.on("_connected", (val) => {
      setConnected(val as boolean)
    })

    setConnected(gw.connected)

    return () => {
      off()
    }
  }, [])

  const on = useCallback((event: string, handler: (data: unknown) => void) => {
    return gatewayRef.current.on(event, handler)
  }, [])

  return { connected, on }
}
