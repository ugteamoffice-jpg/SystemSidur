"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import type { TenantConfig } from "@/lib/tenant-config"

interface TenantContextValue {
  config: TenantConfig | null
  tenantId: string
  loading: boolean
}

const TenantContext = createContext<TenantContextValue>({
  config: null,
  tenantId: "",
  loading: true,
})

export function useTenant() {
  return useContext(TenantContext)
}

// shortcut לשליפת fields
export function useTenantFields() {
  const { config } = useTenant()
  return config?.fields || null
}

export function useTenantTables() {
  const { config } = useTenant()
  return config?.tables || null
}

interface TenantProviderProps {
  tenantId: string
  initialConfig?: TenantConfig
  children: React.ReactNode
}

export function TenantProvider({ tenantId, initialConfig, children }: TenantProviderProps) {
  const [config, setConfig] = useState<TenantConfig | null>(initialConfig || null)
  const [loading, setLoading] = useState(!initialConfig)

  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig)
      setLoading(false)
      return
    }

    // טוען מ-API אם לא סופק
    async function load() {
      try {
        const res = await fetch(`/api/tenant-config?tenant=${tenantId}`)
        if (res.ok) {
          const data = await res.json()
          setConfig(data)
        }
      } catch (err) {
        console.error("Failed to load tenant config:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [tenantId, initialConfig])

  return (
    <TenantContext.Provider value={{ config, tenantId, loading }}>
      {children}
    </TenantContext.Provider>
  )
}
