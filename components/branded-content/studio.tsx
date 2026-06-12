"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ImageDropzone } from "@/components/branded-content/image-dropzone"
import type { Brand, CreativeOutputType, CreativeRequest } from "@/lib/branded-content/types"

const FORMATS = ["1:1", "4:5", "9:16", "16:9"]

const STATUS_STYLES: Record<string, { dot: string; label: string }> = {
  queued: { dot: "bg-amber-400", label: "en cola" },
  provider_running: { dot: "bg-sky-400 animate-pulse", label: "generando" },
  running: { dot: "bg-sky-400 animate-pulse", label: "generando" },
  ready: { dot: "bg-emerald-400", label: "listo" },
  completed: { dot: "bg-emerald-400", label: "completado" },
  succeeded: { dot: "bg-emerald-400", label: "completado" },
  failed: { dot: "bg-destructive", label: "falló" },
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
  const [referenceImages, setReferenceImages] = useState<{ url: string; path: string }[]>([])
  const [refUploading, setRefUploading] = useState(false)
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
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el studio")
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

  const handleReferenceUpload = async (file: File) => {
    setRefUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const response = await fetch("/api/request-references", { method: "POST", body: formData })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.details || json.error || "No se pudo subir la referencia")
      }
      setReferenceImages((current) => [{ url: json.url as string, path: json.path as string }, ...current])
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "No se pudo subir la referencia")
    } finally {
      setRefUploading(false)
    }
  }

  const handleRemoveReference = async (path: string) => {
    setReferenceImages((current) => current.filter((image) => image.path !== path))
    try {
      await fetch(`/api/request-references?path=${encodeURIComponent(path)}`, { method: "DELETE" })
    } catch {
      // image is already gone from the UI; an orphaned storage object is harmless
    }
  }

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
          referenceImageUrls: referenceImages.map((image) => image.url),
          metadata: {
            avatar: avatar || undefined,
            voice: voice || undefined,
          },
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.details || json.error || "No se pudo crear el pedido")
      }
      router.push(`/requests/${json.requestId}`)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo crear el pedido")
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
            <span className="eyebrow">Viva Studio · Motor de contenido con IA</span>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
              Contenido de <span className="text-brand-gradient">marca</span>
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
              <Link href="/brand">Editar marca</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_380px]">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle>Crear pieza</CardTitle>
              <CardDescription>{helperCopy}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Marca</Label>
                  <Select value={brandId} onValueChange={setBrandId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Elegí una marca" />
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
                  <Label>Tipo de salida</Label>
                  <Select value={outputType} onValueChange={(value) => setOutputType(value as CreativeOutputType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single_image">Imagen</SelectItem>
                      <SelectItem value="avatar_video">Video con avatar</SelectItem>
                      <SelectItem value="mascot_video">Video con mascota</SelectItem>
                      <SelectItem value="carousel">Carrusel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Pedido en lenguaje natural</Label>
                <Textarea
                  rows={7}
                  placeholder="Ej: Quiero una imagen editorial para Instagram anunciando nuestro workshop premium..."
                  value={userPrompt}
                  onChange={(event) => setUserPrompt(event.target.value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Formato</Label>
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
                  <Input value={cta} onChange={(event) => setCta(event.target.value)} placeholder="Reservá una demo" />
                </div>
                <div className="space-y-2">
                  <Label>Contexto de campaña</Label>
                  <Input
                    value={campaignContext}
                    onChange={(event) => setCampaignContext(event.target.value)}
                    placeholder="Lanzamiento de junio"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Imágenes de referencia (opcional)</Label>
                <p className="text-xs text-muted-foreground">
                  Sumá una prenda, un modelo o un estilo para que la pieza salga más personalizada.
                </p>
                <ImageDropzone
                  label="Referencia"
                  description="Prenda, modelo, estilo, paleta…"
                  uploading={refUploading}
                  onFile={handleReferenceUpload}
                />
                {referenceImages.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {referenceImages.map((image) => (
                      <div
                        key={image.path}
                        className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-input/40"
                      >
                        <img src={image.url} alt="Referencia" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          aria-label="Quitar referencia"
                          onClick={() => handleRemoveReference(image.path)}
                          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground opacity-0 backdrop-blur transition-all hover:border-destructive/50 hover:text-destructive group-hover:opacity-100"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {(outputType === "avatar_video" || outputType === "mascot_video") && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Avatar / Mascota</Label>
                    <Input
                      value={avatar}
                      onChange={(event) => setAvatar(event.target.value)}
                      placeholder="ID de mascota o descripción corta"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Voz</Label>
                    <Input
                      value={voice}
                      onChange={(event) => setVoice(event.target.value)}
                      placeholder="Preset de voz"
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
                {submitting ? "Creando…" : "Generar pieza"}
              </Button>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle>Pedidos recientes</CardTitle>
              <CardDescription>Guardado en Supabase, no en el navegador.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {requests.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no hay pedidos.</p>
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
