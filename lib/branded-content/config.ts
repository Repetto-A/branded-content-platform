import type { CreativeOutputType } from "@/lib/branded-content/types"

export function getHashiApiKey() {
  const apiKey = process.env.HASHI_API_KEY
  if (!apiKey) {
    throw new Error("HASHI_API_KEY is missing.")
  }
  return apiKey
}

export function getHashiWorkflowId(outputType: CreativeOutputType) {
  const mapping: Record<CreativeOutputType, string | undefined> = {
    single_image: process.env.HASHI_IMAGE_WORKFLOW_ID,
    avatar_video: process.env.HASHI_VIDEO_WORKFLOW_ID,
    mascot_video: process.env.HASHI_VIDEO_WORKFLOW_ID,
    carousel: process.env.HASHI_CAROUSEL_WORKFLOW_ID,
  }

  const workflowId = mapping[outputType]
  if (!workflowId) {
    throw new Error(`No Hashi workflow configured for output type "${outputType}".`)
  }

  return workflowId
}

export function getHashiWebhookUrl(workflowId: string) {
  return `https://www.hashiapp.com/api/workflows/${workflowId}/webhook`
}
