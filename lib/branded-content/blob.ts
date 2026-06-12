import { getSupabaseServerClient } from "@/lib/supabase/server"

const DEFAULT_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "branded-content"

function inferExtensionFromContentType(contentType: string | null) {
  if (!contentType) return "bin"
  if (contentType.includes("png")) return "png"
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg"
  if (contentType.includes("webp")) return "webp"
  if (contentType.includes("gif")) return "gif"
  if (contentType.includes("mp4")) return "mp4"
  if (contentType.includes("webm")) return "webm"
  if (contentType.includes("json")) return "json"
  return "bin"
}

export async function mirrorRemoteAssetToSupabase(url: string, filenamePrefix: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch remote asset: ${response.status}`)
  }

  const contentType = response.headers.get("content-type") || "application/octet-stream"
  const arrayBuffer = await response.arrayBuffer()
  const extension = inferExtensionFromContentType(contentType)
  const objectPath = `creative-outputs/${Date.now()}-${filenamePrefix}.${extension}`

  const supabase = getSupabaseServerClient()
  const bucket = DEFAULT_STORAGE_BUCKET
  const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, arrayBuffer, {
    contentType,
    upsert: false,
    cacheControl: "3600",
  })
  if (uploadError) {
    throw new Error(`Failed to mirror provider asset to Supabase Storage: ${uploadError.message}`)
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath)
  return data.publicUrl
}

// Backward-compatible export while callers are migrated.
export const mirrorRemoteAssetToBlob = mirrorRemoteAssetToSupabase
