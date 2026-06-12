import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

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

/**
 * Per-request reference images. Unlike brand assets these are ephemeral — they
 * live in storage tied to a single creative request and never become rows in
 * brand_assets, so they don't pollute the brand library.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "A file is required" }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const extension = extensionFromFile(file)
    const fileBaseName = safeName(file.name.replace(/\.[^.]+$/, ""))
    const objectPath = `request-references/${Date.now()}-${fileBaseName}.${extension}`

    const supabase = getSupabaseServerClient()
    const { error: uploadError } = await supabase.storage
      .from(DEFAULT_STORAGE_BUCKET)
      .upload(objectPath, arrayBuffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
        cacheControl: "3600",
      })
    if (uploadError) {
      throw new Error(`Failed to upload reference image: ${uploadError.message}`)
    }

    const { data } = supabase.storage.from(DEFAULT_STORAGE_BUCKET).getPublicUrl(objectPath)
    return NextResponse.json({ url: data.publicUrl, path: objectPath })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to upload reference image",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const path = request.nextUrl.searchParams.get("path")
    if (!path || !path.startsWith("request-references/")) {
      return NextResponse.json({ error: "A valid reference path is required" }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()
    const { error } = await supabase.storage.from(DEFAULT_STORAGE_BUCKET).remove([path])
    if (error) {
      throw new Error(`Failed to delete reference image: ${error.message}`)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to delete reference image",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
