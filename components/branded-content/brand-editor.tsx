"use client"

import type { ChangeEvent } from "react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
      setError(loadError instanceof Error ? loadError.message : "Failed to load brand")
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
        throw new Error(json.details || json.error || "Failed to save brand")
      }
      setBundle(json)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save brand")
    } finally {
      setSaving(false)
    }
  }

  const handleReferenceUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!bundle || !event.target.files?.[0]) return
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append("brandId", bundle.brand.id)
      formData.append("type", "reference_image")
      formData.append("usage", "provider_reference")
      formData.append("label", event.target.files[0].name)
      formData.append("file", event.target.files[0])
      const response = await fetch("/api/brand-assets", {
        method: "POST",
        body: formData,
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.details || json.error || "Failed to upload asset")
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
      setError(uploadError instanceof Error ? uploadError.message : "Failed to upload asset")
    } finally {
      setUploading(false)
    }
  }

  const handleBrandImageUpload =
    (options: { type: "logo" | "mascot" | "avatar"; usage: "always" | "provider_reference"; brandField: "logoUrl" | "mascotAssetUrl" }) =>
    async (event: ChangeEvent<HTMLInputElement>) => {
      if (!bundle || !event.target.files?.[0]) return
      setUploading(true)
      setError(null)

      try {
        const file = event.target.files[0]
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
          throw new Error(json.details || json.error || "Failed to upload asset")
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
        setError(uploadError instanceof Error ? uploadError.message : "Failed to upload asset")
      } finally {
        setUploading(false)
      }
    }

  if (!bundle) {
    return <div className="p-8 text-sm text-muted-foreground">Loading brand profile...</div>
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 md:px-8">
      <Card>
        <CardHeader>
          <CardTitle>Brand setup</CardTitle>
          <CardDescription>Structured context only. No raw brandbook dump by default.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Name</Label>
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
              <Label>Website URL</Label>
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
            <Label>Description</Label>
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
              <Label>Tone (comma separated)</Label>
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
              <Label>Avoid (comma separated)</Label>
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
              <Label>Visual mood (comma separated)</Label>
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
              <Label>Forbidden styles (comma separated)</Label>
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
            <Label>Context summary</Label>
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
            <div className="space-y-2">
              <Label>Logo</Label>
              {bundle.brand.logoUrl ? (
                <div className="space-y-2">
                  <img src={bundle.brand.logoUrl} alt="Brand logo" className="h-24 w-auto rounded-md border object-contain p-2" />
                  <a href={bundle.brand.logoUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                    Open current logo
                  </a>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No logo uploaded yet.</p>
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={handleBrandImageUpload({ type: "logo", usage: "always", brandField: "logoUrl" })}
                disabled={uploading}
              />
            </div>
            <div className="space-y-2">
              <Label>Mascot / avatar image</Label>
              {bundle.brand.mascotAssetUrl ? (
                <div className="space-y-2">
                  <img src={bundle.brand.mascotAssetUrl} alt="Mascot or avatar" className="h-24 w-auto rounded-md border object-contain p-2" />
                  <a href={bundle.brand.mascotAssetUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                    Open current mascot / avatar
                  </a>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No mascot or avatar uploaded yet.</p>
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={handleBrandImageUpload({ type: "mascot", usage: "provider_reference", brandField: "mascotAssetUrl" })}
                disabled={uploading}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Reference assets</Label>
            <Input type="file" accept="image/*" onChange={handleReferenceUpload} disabled={uploading} />
            <div className="grid gap-2 md:grid-cols-2">
              {bundle.assets.map((asset) => (
                <div key={asset.id} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{asset.label || asset.type}</p>
                  <p className="text-xs text-muted-foreground">{asset.usage}</p>
                  {asset.type === "logo" || asset.type === "reference_image" || asset.type === "mascot" || asset.type === "avatar" ? (
                    <img src={asset.url} alt={asset.label || asset.type} className="mt-2 h-24 w-auto rounded-md border object-contain p-2" />
                  ) : null}
                  <a href={asset.url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                    Open asset
                  </a>
                </div>
              ))}
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save brand"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
