import { NextRequest, NextResponse } from "next/server"
import { createBrand, listBrands } from "@/lib/branded-content/repository"

export async function GET() {
  try {
    const brands = await listBrands()
    return NextResponse.json({ brands })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to list brands",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.name) {
      return NextResponse.json({ error: "Brand name is required" }, { status: 400 })
    }
    const brand = await createBrand({
      name: body.name,
      description: body.description,
      websiteUrl: body.websiteUrl,
      logoUrl: body.logoUrl,
      mascotAssetUrl: body.mascotAssetUrl,
    })
    return NextResponse.json({ brand })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create brand",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
