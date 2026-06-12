"use client"

import { useEffect, useState } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ImageDropzone } from "@/components/branded-content/image-dropzone"
import type { BrandAsset, BrandBundle } from "@/lib/branded-content/types"

function parseCsv(input: string) {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

export function BrandEditor() {
  const [bundle, setBundle] = useState<BrandBundle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    const load = async () => {
      const brandsRes = await fetch("/api/brands")
      const brandsJson = await brandsRes.json()
      const firstBrand = brandsJson.brands?.[0]
      if (!firstBrand) return
      const bundleRes = await fetch(`/api/brands/${firstBrand.id}`)
      const bundleJson = await bundleRes.json()
      setBundle(bundleJson)
    }

    load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la marca")
    })
  }, [])

  const handleSave = async () => {
    if (!bundle) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/brands/${bundle.brand.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bundle),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.details || json.error || "No se pudo guardar la marca")
      }
      setBundle(json)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la marca")
    } finally {
      setSaving(false)
    }
  }

  const handleReferenceUpload = async (file: File) => {
    if (!bundle) return
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append("brandId", bundle.brand.id)
      formData.append("type", "reference_image")
      formData.append("usage", "provider_reference")
      formData.append("label", file.name)
      formData.append("file", file)
      const response = await fetch("/api/brand-assets", {
        method: "POST",
        body: formData,
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.details || json.error || "No se pudo subir el archivo")
      }
      setBundle((current) =>
        current
          ? {
              ...current,
              assets: [json.asset as BrandAsset, ...current.assets],
            }
          : current,
      )
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "No se pudo subir el archivo")
    } finally {
      setUploading(false)
    }
  }

  const handleBrandImageUpload =
    (options: { type: "logo" | "mascot" | "avatar"; usage: "always" | "provider_reference"; brandField: "logoUrl" | "mascotAssetUrl" }) =>
    async (file: File) => {
      if (!bundle) return
      setUploading(true)
      setError(null)

      try {
        const formData = new FormData()
        formData.append("brandId", bundle.brand.id)
        formData.append("type", options.type)
        formData.append("usage", options.usage)
        formData.append("label", file.name)
        formData.append("file", file)

        const response = await fetch("/api/brand-assets", {
          method: "POST",
          body: formData,
        })
        const json = await response.json()
        if (!response.ok) {
          throw new Error(json.details || json.error || "No se pudo subir el archivo")
        }

        setBundle((current) =>
          current
            ? {
                ...current,
                brand: json.brand
                  ? json.brand
                  : {
                      ...current.brand,
                      [options.brandField]: json.asset.url,
                    },
                assets: [json.asset as BrandAsset, ...current.assets],
              }
            : current,
        )
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : "No se pudo subir el archivo")
      } finally {
        setUploading(false)
      }
    }

  const handleDeleteAsset = async (assetId: string) => {
    setUploading(true)
    setError(null)
    try {
      const response = await fetch(`/api/brand-assets?id=${encodeURIComponent(assetId)}`, {
        method: "DELETE",
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.details || json.error || "No se pudo borrar el archivo")
      }
      if (json.bundle) setBundle(json.bundle as BrandBundle)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo borrar el archivo")
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveBrandImage =
    (field: "logoUrl" | "mascotAssetUrl") => async () => {
      if (!bundle) return
      const url = bundle.brand[field]
      if (!url) return

      // If the image is one of our uploaded assets, delete it (also clears the pointer).
      const matchingAsset = bundle.assets.find((asset) => asset.url === url)
      if (matchingAsset) {
        await handleDeleteAsset(matchingAsset.id)
        return
      }

      // Otherwise it's an external/seeded URL — just clear the brand pointer.
      setUploading(true)
      setError(null)
      try {
        const response = await fetch(`/api/brands/${bundle.brand.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brand: { [field]: null }, profile: {} }),
        })
        const json = await response.json()
        if (!response.ok) {
          throw new Error(json.details || json.error || "No se pudo quitar la imagen")
        }
        setBundle(json as BrandBundle)
      } catch (removeError) {
        setError(removeError instanceof Error ? removeError.message : "No se pudo quitar la imagen")
      } finally {
        setUploading(false)
      }
    }

  if (!bundle) {
    return <div className="p-8 text-sm text-muted-foreground">Cargando perfil de marca…</div>
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 md:px-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <span className="eyebrow">Configuración de marca</span>
          <h1 className="text-3xl font-semibold tracking-tight">
            Identidad de <span className="text-brand-gradient">{bundle.brand.name || "tu marca"}</span>
          </h1>
        </div>
        <Button asChild variant="outline" className="rounded-full">
          <a href="/">← Volver al studio</a>
        </Button>
      </div>
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle>Perfil de marca</CardTitle>
          <CardDescription>Contexto estructurado. Tono, estilo visual y assets que guían cada pieza.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={bundle.brand.name}
                onChange={(event) =>
                  setBundle((current) =>
                    current ? { ...current, brand: { ...current.brand, name: event.target.value } } : current,
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Sitio web</Label>
              <Input
                value={bundle.brand.websiteUrl ?? ""}
                onChange={(event) =>
                  setBundle((current) =>
                    current ? { ...current, brand: { ...current.brand, websiteUrl: event.target.value } } : current,
                  )
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea
              rows={3}
              value={bundle.brand.description ?? ""}
              onChange={(event) =>
                setBundle((current) =>
                  current ? { ...current, brand: { ...current.brand, description: event.target.value } } : current,
                )
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tono (separado por comas)</Label>
              <Input
                value={(bundle.profile.voice.tone ?? []).join(", ")}
                onChange={(event) =>
                  setBundle((current) =>
                    current
                      ? {
                          ...current,
                          profile: {
                            ...current.profile,
                            voice: { ...current.profile.voice, tone: parseCsv(event.target.value) },
                          },
                        }
                      : current,
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Evitar (separado por comas)</Label>
              <Input
                value={(bundle.profile.voice.avoid ?? []).join(", ")}
                onChange={(event) =>
                  setBundle((current) =>
                    current
                      ? {
                          ...current,
                          profile: {
                            ...current.profile,
                            voice: { ...current.profile.voice, avoid: parseCsv(event.target.value) },
                          },
                        }
                      : current,
                  )
                }
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Mood visual (separado por comas)</Label>
              <Input
                value={(bundle.profile.visualStyle.mood ?? []).join(", ")}
                onChange={(event) =>
                  setBundle((current) =>
                    current
                      ? {
                          ...current,
                          profile: {
                            ...current.profile,
                            visualStyle: { ...current.profile.visualStyle, mood: parseCsv(event.target.value) },
                          },
                        }
                      : current,
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Estilos prohibidos (separado por comas)</Label>
              <Input
                value={(bundle.profile.visualStyle.forbiddenStyles ?? []).join(", ")}
                onChange={(event) =>
                  setBundle((current) =>
                    current
                      ? {
                          ...current,
                          profile: {
                            ...current.profile,
                            visualStyle: {
                              ...current.profile.visualStyle,
                              forbiddenStyles: parseCsv(event.target.value),
                            },
                          },
                        }
                      : current,
                  )
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Resumen de contexto</Label>
            <Textarea
              rows={4}
              value={bundle.profile.contextSummary}
              onChange={(event) =>
                setBundle((current) =>
                  current ? { ...current, profile: { ...current.profile, contextSummary: event.target.value } } : current,
                )
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ImageDropzone
              label="Logo"
              description="Se incluye en las piezas cuando aplica"
              value={bundle.brand.logoUrl}
              uploading={uploading}
              onFile={handleBrandImageUpload({ type: "logo", usage: "always", brandField: "logoUrl" })}
              onRemove={handleRemoveBrandImage("logoUrl")}
            />
            <ImageDropzone
              label="Mascota / avatar"
              description="Personaje de referencia para videos"
              value={bundle.brand.mascotAssetUrl}
              uploading={uploading}
              onFile={handleBrandImageUpload({ type: "mascot", usage: "provider_reference", brandField: "mascotAssetUrl" })}
              onRemove={handleRemoveBrandImage("mascotAssetUrl")}
            />
          </div>

          <div className="space-y-3">
            <ImageDropzone
              label="Assets de referencia"
              description="Imágenes que guían el estilo visual"
              uploading={uploading}
              onFile={handleReferenceUpload}
            />
            {bundle.assets.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {bundle.assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="group relative overflow-hidden rounded-xl border border-border bg-card/40 transition-colors hover:border-brand/40"
                  >
                    <button
                      type="button"
                      aria-label={`Borrar ${asset.label || asset.type}`}
                      disabled={uploading}
                      onClick={() => handleDeleteAsset(asset.id)}
                      className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground opacity-0 backdrop-blur transition-all hover:border-destructive/50 hover:text-destructive group-hover:opacity-100 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <a href={asset.url} target="_blank" rel="noreferrer" className="block">
                      {asset.type === "logo" || asset.type === "reference_image" || asset.type === "mascot" || asset.type === "avatar" ? (
                        <img
                          src={asset.url}
                          alt={asset.label || asset.type}
                          className="aspect-video w-full bg-input/40 object-contain p-2 transition-transform group-hover:scale-[1.02]"
                        />
                      ) : null}
                      <div className="space-y-0.5 p-3">
                        <p className="truncate text-sm font-medium">{asset.label || asset.type}</p>
                        <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{asset.usage}</p>
                      </div>
                    </a>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button
            onClick={handleSave}
            disabled={saving}
            size="lg"
            className="brand-gradient font-medium text-white shadow-lg transition-opacity hover:opacity-90"
          >
            {saving ? "Guardando…" : "Guardar marca"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
