"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Brand, CreativeOutputType, CreativeRequest } from "@/lib/branded-content/types"

const FORMATS = ["1:1", "4:5", "9:16", "16:9"]

const STATUS_STYLES: Record<string, { dot: string; label: string }> = {
  queued: { dot: "bg-amber-400", label: "queued" },
  running: { dot: "bg-sky-400 animate-pulse", label: "running" },
  completed: { dot: "bg-emerald-400", label: "completed" },
  succeeded: { dot: "bg-emerald-400", label: "succeeded" },
  failed: { dot: "bg-destructive", label: "failed" },
}

function StatusDot({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? { dot: "bg-muted-foreground", label: status }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  )
}

export function BrandedStudio() {
  const router = useRouter()
  const [brands, setBrands] = useState<Brand[]>([])
  const [requests, setRequests] = useState<CreativeRequest[]>([])
  const [brandId, setBrandId] = useState("")
  const [outputType, setOutputType] = useState<CreativeOutputType>("single_image")
  const [userPrompt, setUserPrompt] = useState("")
  const [format, setFormat] = useState("4:5")
  const [cta, setCta] = useState("")
  const [campaignContext, setCampaignContext] = useState("")
  const [avatar, setAvatar] = useState("")
  const [voice, setVoice] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const [brandsRes, requestsRes] = await Promise.all([fetch("/api/brands"), fetch("/api/creative-requests")])
      const brandsJson = await brandsRes.json()
      const requestsJson = await requestsRes.json()
      setBrands(brandsJson.brands ?? [])
      setRequests(requestsJson.requests ?? [])
      if (brandsJson.brands?.[0]?.id) {
        setBrandId((current) => current || brandsJson.brands[0].id)
      }
    }

    load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Failed to load studio")
    })
  }, [])

  const helperCopy = useMemo(() => {
    switch (outputType) {
      case "single_image":
        return "Pedí una imagen de marca usando prompt libre, tono y contexto de campaña."
      case "avatar_video":
      case "mascot_video":
        return "Definí guion, voz y personaje para un video corto con avatar o mascota."
      case "carousel":
        return "El sistema va a generar un slide plan estructurado más los assets visuales."
    }
  }, [outputType])

  const handleSubmit = async () => {
    if (!brandId || !userPrompt.trim()) {
      setError("Elegí una marca y escribí el pedido.")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/creative-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          outputType,
          userPrompt,
          format,
          cta: cta || undefined,
          campaignContext: campaignContext || undefined,
          metadata: {
            avatar: avatar || undefined,
            voice: voice || undefined,
          },
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.details || json.error || "Failed to create request")
      }
      router.push(`/requests/${json.requestId}`)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create request")
    } finally {
      setSubmitting(false)
    }
  }

  const selectedBrand = brands.find((brand) => brand.id === brandId)

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 md:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <span className="eyebrow">Viva Studio · AI Content Engine</span>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
              Branded Content <span className="text-brand-gradient">Studio</span>
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              Generá imágenes, carruseles y videos con avatar fieles a tu marca. Tu identidad, tono y
              assets en cada pieza — sin partir de cero.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {selectedBrand?.logoUrl ? (
              <span className="flex h-11 items-center gap-2 rounded-full border border-border bg-card/60 px-3 backdrop-blur">
                <img
                  src={selectedBrand.logoUrl}
                  alt={selectedBrand.name}
                  className="h-6 w-auto max-w-24 object-contain"
                />
              </span>
            ) : null}
            <Button asChild variant="outline" className="h-11 rounded-full px-5">
              <Link href="/brand">Brand setup</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_380px]">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle>Create request</CardTitle>
              <CardDescription>{helperCopy}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Brand</Label>
                  <Select value={brandId} onValueChange={setBrandId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map((brand) => (
                        <SelectItem key={brand.id} value={brand.id}>
                          {brand.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Output type</Label>
                  <Select value={outputType} onValueChange={(value) => setOutputType(value as CreativeOutputType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single_image">Single image</SelectItem>
                      <SelectItem value="avatar_video">Avatar video</SelectItem>
                      <SelectItem value="mascot_video">Mascot video</SelectItem>
                      <SelectItem value="carousel">Carousel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Natural-language request</Label>
                <Textarea
                  rows={7}
                  placeholder="Ej: Quiero una imagen editorial para Instagram anunciando nuestro workshop premium..."
                  value={userPrompt}
                  onChange={(event) => setUserPrompt(event.target.value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select value={format} onValueChange={setFormat}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMATS.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>CTA</Label>
                  <Input value={cta} onChange={(event) => setCta(event.target.value)} placeholder="Book a demo" />
                </div>
                <div className="space-y-2">
                  <Label>Campaign context</Label>
                  <Input
                    value={campaignContext}
                    onChange={(event) => setCampaignContext(event.target.value)}
                    placeholder="June launch"
                  />
                </div>
              </div>

              {(outputType === "avatar_video" || outputType === "mascot_video") && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Avatar / Mascot</Label>
                    <Input
                      value={avatar}
                      onChange={(event) => setAvatar(event.target.value)}
                      placeholder="Mascot ID or short descriptor"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Voice</Label>
                    <Input
                      value={voice}
                      onChange={(event) => setVoice(event.target.value)}
                      placeholder="Voice preset"
                    />
                  </div>
                </div>
              )}

              {error ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              <Button
                onClick={handleSubmit}
                disabled={submitting || !brandId}
                size="lg"
                className="brand-gradient w-full font-medium text-white shadow-lg transition-opacity hover:opacity-90 sm:w-auto"
              >
                {submitting ? "Creando request..." : "Run workflow"}
              </Button>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle>Recent requests</CardTitle>
              <CardDescription>Tracked in Supabase, not localStorage.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {requests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No requests yet.</p>
              ) : (
                requests.slice(0, 8).map((request) => (
                  <Link
                    key={request.id}
                    href={`/requests/${request.id}`}
                    className="block rounded-xl border border-border bg-card/40 p-3 transition-colors hover:border-brand/40 hover:bg-muted/40"
                  >
                    <div className="space-y-2">
                      <p className="line-clamp-2 text-sm font-medium leading-snug">{request.userPrompt}</p>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                          {request.outputType}
                        </span>
                        <StatusDot status={request.status} />
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
