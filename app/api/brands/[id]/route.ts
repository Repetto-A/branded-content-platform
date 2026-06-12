import { NextRequest, NextResponse } from "next/server"
import { getBrandBundle, updateBrandBundle } from "@/lib/branded-content/repository"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const bundle = await getBrandBundle(id)
    return NextResponse.json(bundle)
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch brand",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()
    const bundle = await updateBrandBundle(id, {
      brand: body.brand ?? {},
      profile: body.profile ?? {},
    })
    return NextResponse.json(bundle)
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to update brand",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
