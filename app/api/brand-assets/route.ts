import { NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { createBrandAsset } from "@/lib/branded-content/repository"
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
      const bytes = await file.arrayBuffer()
      const uploaded = await put(`brand-asset-${brandId}-${file.name}`, new Blob([bytes], { type: file.type }), {
        access: "public",
        contentType: file.type,
        addRandomSuffix: true,
      })
      url = uploaded.url
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

    return NextResponse.json({ asset })
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
