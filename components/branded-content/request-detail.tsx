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
        throw new Error(json.details || json.error || "Failed to load request")
      }
      if (!cancelled) setData(json)
    }

    load()
      .then(() => {
        interval = setInterval(() => {
          load().catch((loadError) => {
            if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Failed to refresh request")
          })
        }, 4000)
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Failed to load request")
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
      if (!response.ok) throw new Error(json.details || json.error || "Failed to regenerate")
      window.location.href = `/requests/${json.request.id}`
    } catch (regenerateError) {
      setError(regenerateError instanceof Error ? regenerateError.message : "Failed to regenerate")
      setBusy(false)
    }
  }

  if (!data) {
    return <div className="p-8 text-sm text-muted-foreground">Loading request...</div>
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Creative request</h1>
          <p className="text-sm text-muted-foreground">
            {data.request.outputType} • {data.request.status} • approval {data.request.approvalStatus}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/">Back to studio</Link>
          </Button>
          <Button variant="outline" onClick={handleRegenerate} disabled={busy}>
            Regenerate
          </Button>
          <Button onClick={handleApprove} disabled={busy || data.request.approvalStatus === "approved"}>
            {data.request.approvalStatus === "approved" ? "Approved" : "Mark approved"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Outputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.outputs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No outputs yet. This page auto-refreshes.</p>
            ) : (
              data.outputs.map((output: any) => (
                <div key={output.id} className="rounded-lg border p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{output.type}</p>
                    {output.url ? (
                      <a className="text-xs text-primary underline" href={output.url} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    ) : null}
                  </div>

                  {output.type === "image" && output.url ? (
                    <img src={output.url} alt="Generated output" className="w-full rounded-md border" />
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
          <Card>
            <CardHeader>
              <CardTitle>Request</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>{data.request.userPrompt}</p>
              <p className="text-muted-foreground">Brand: {data.brand.name}</p>
              <p className="text-muted-foreground">Format: {data.request.format || "n/a"}</p>
              <p className="text-muted-foreground">Workflow status: {data.workflowStatus || "unknown"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Execution trace</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>Status: {data.latestJob?.status || "n/a"}</p>
              <p>Provider: {data.latestJob?.provider || "n/a"}</p>
              <p>Execution ID: {data.latestJob?.providerExecutionId || "pending"}</p>
              <p>Workflow run: {data.latestJob?.workflowRunId || "pending"}</p>
              {data.latestJob?.errorMessage ? <p className="text-destructive">{data.latestJob.errorMessage}</p> : null}
            </CardContent>
          </Card>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </div>
    </div>
  )
}
