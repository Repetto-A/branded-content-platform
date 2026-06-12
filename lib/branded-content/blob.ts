import { put } from "@vercel/blob"

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

export async function mirrorRemoteAssetToBlob(url: string, filenamePrefix: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch remote asset: ${response.status}`)
  }

  const contentType = response.headers.get("content-type") || "application/octet-stream"
  const arrayBuffer = await response.arrayBuffer()
  const extension = inferExtensionFromContentType(contentType)
  const file = new Blob([arrayBuffer], { type: contentType })
  const uploaded = await put(`${filenamePrefix}.${extension}`, file, {
    access: "public",
    contentType,
    addRandomSuffix: true,
  })

  return uploaded.url
}
