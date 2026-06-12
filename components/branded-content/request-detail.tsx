"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface RequestDetailProps {
  requestId: string
}

export function RequestDetail({ requestId }: RequestDetailProps) {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    let interval: NodeJS.Timeout | null = null

    const load = async () => {
      const response = await fetch(`/api/creative-requests/${requestId}/status`, { cache: "no-store" })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.details || json.error || "No se pudo cargar el pedido")
      }
      if (!cancelled) setData(json)
    }

    load()
      .then(() => {
        interval = setInterval(() => {
          load().catch((loadError) => {
            if (!cancelled) setError(loadError instanceof Error ? loadError.message : "No se pudo actualizar el pedido")
          })
        }, 4000)
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el pedido")
      })

    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
    }
  }, [requestId])

  const handleApprove = async () => {
    setBusy(true)
    try {
      await fetch(`/api/creative-requests/${requestId}/approve`, { method: "POST" })
      const refreshed = await fetch(`/api/creative-requests/${requestId}/status`)
      setData(await refreshed.json())
    } finally {
      setBusy(false)
    }
  }

  const handleRegenerate = async () => {
    setBusy(true)
    try {
      const response = await fetch(`/api/creative-requests/${requestId}/regenerate`, { method: "POST" })
      const json = await response.json()
      if (!response.ok) throw new Error(json.details || json.error || "No se pudo regenerar")
      window.location.href = `/requests/${json.request.id}`
    } catch (regenerateError) {
      setError(regenerateError instanceof Error ? regenerateError.message : "No se pudo regenerar")
      setBusy(false)
    }
  }

  if (!data) {
    return <div className="p-8 text-sm text-muted-foreground">Cargando pedido…</div>
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pedido creativo</h1>
          <p className="text-sm text-muted-foreground">
            {data.request.outputType} • {data.request.status} • aprobación {data.request.approvalStatus}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/">Volver al studio</Link>
          </Button>
          <Button variant="outline" onClick={handleRegenerate} disabled={busy}>
            Regenerar
          </Button>
          <Button onClick={handleApprove} disabled={busy || data.request.approvalStatus === "approved"}>
            {data.request.approvalStatus === "approved" ? "Aprobado" : "Marcar como aprobado"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_360px]">
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle>Resultados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.outputs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay resultados. Esta página se actualiza sola.</p>
            ) : (
              data.outputs.map((output: any) => (
                <div key={output.id} className="rounded-lg border p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{output.type}</p>
                    {output.url ? (
                      <a className="text-xs text-primary underline" href={output.url} target="_blank" rel="noreferrer">
                        Abrir
                      </a>
                    ) : null}
                  </div>

                  {output.type === "image" && output.url ? (
                    <img src={output.url} alt="Resultado generado" className="w-full rounded-md border" />
                  ) : null}

                  {output.type === "video" && output.url ? (
                    <video src={output.url} controls className="w-full rounded-md border bg-black" />
                  ) : null}

                  {output.type === "json" ? (
                    <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                      {JSON.stringify(output.metadata ?? {}, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle>Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>{data.request.userPrompt}</p>
              <p className="text-muted-foreground">Marca: {data.brand.name}</p>
              <p className="text-muted-foreground">Formato: {data.request.format || "n/a"}</p>
              <p className="text-muted-foreground">Estado del workflow: {data.workflowStatus || "desconocido"}</p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle>Traza de ejecución</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>Estado: {data.latestJob?.status || "n/a"}</p>
              <p>Proveedor: {data.latestJob?.provider || "n/a"}</p>
              <p>ID de ejecución: {data.latestJob?.providerExecutionId || "pendiente"}</p>
              <p>Run del workflow: {data.latestJob?.workflowRunId || "pendiente"}</p>
              {data.latestJob?.errorMessage ? <p className="text-destructive">{data.latestJob.errorMessage}</p> : null}
            </CardContent>
          </Card>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </div>
    </div>
  )
}
