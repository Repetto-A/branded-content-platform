import { NextRequest, NextResponse } from "next/server"
import { createBrandAsset, deleteBrandAsset, updateBrandBundle } from "@/lib/branded-content/repository"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import type { BrandAssetType, BrandAssetUsage } from "@/lib/branded-content/types"

const VALID_TYPES = new Set<BrandAssetType>([
  "logo",
  "reference_image",
  "mascot",
  "avatar",
  "brandbook",
  "website_snapshot",
])

const VALID_USAGES = new Set<BrandAssetUsage>(["always", "optional", "provider_reference", "internal_context"])
const DEFAULT_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "branded-content"

function safeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]/g, "-")
}

function extensionFromFile(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase()
  if (fromName) return fromName
  if (file.type.includes("jpeg")) return "jpg"
  if (file.type.includes("png")) return "png"
  if (file.type.includes("webp")) return "webp"
  if (file.type.includes("gif")) return "gif"
  return "bin"
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const brandId = String(formData.get("brandId") ?? "")
    const type = String(formData.get("type") ?? "") as BrandAssetType
    const usage = String(formData.get("usage") ?? "optional") as BrandAssetUsage
    const label = String(formData.get("label") ?? "")
    const description = String(formData.get("description") ?? "")
    const providedUrl = String(formData.get("url") ?? "")
    const file = formData.get("file") as File | null

    if (!brandId || !VALID_TYPES.has(type)) {
      return NextResponse.json({ error: "brandId and a valid asset type are required" }, { status: 400 })
    }
    if (!VALID_USAGES.has(usage)) {
      return NextResponse.json({ error: "Invalid asset usage" }, { status: 400 })
    }

    let url = providedUrl
    if (file) {
      const arrayBuffer = await file.arrayBuffer()
      const extension = extensionFromFile(file)
      const fileBaseName = safeName(file.name.replace(/\.[^.]+$/, ""))
      const objectPath = `brand-assets/${brandId}/${Date.now()}-${fileBaseName}.${extension}`

      const supabase = getSupabaseServerClient()
      const bucket = DEFAULT_STORAGE_BUCKET
      const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, arrayBuffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
        cacheControl: "3600",
      })
      if (uploadError) {
        throw new Error(`Failed to upload brand asset to Supabase Storage: ${uploadError.message}`)
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath)
      url = data.publicUrl
    }

    if (!url) {
      return NextResponse.json({ error: "Either a file or a URL is required" }, { status: 400 })
    }

    const asset = await createBrandAsset({
      brandId,
      type,
      url,
      usage,
      label: label || null,
      description: description || null,
    })

    let brand = undefined
    if (type === "logo") {
      const updatedBundle = await updateBrandBundle(brandId, {
        brand: { logoUrl: url },
        profile: {},
      })
      brand = updatedBundle.brand
    } else if (type === "mascot" || type === "avatar") {
      const updatedBundle = await updateBrandBundle(brandId, {
        brand: { mascotAssetUrl: url },
        profile: {},
      })
      brand = updatedBundle.brand
    }

    return NextResponse.json({ asset, brand })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create brand asset",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const assetId = request.nextUrl.searchParams.get("id")
    if (!assetId) {
      return NextResponse.json({ error: "Asset id is required" }, { status: 400 })
    }

    const bundle = await deleteBrandAsset(assetId)
    return NextResponse.json({ bundle })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to delete brand asset",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
