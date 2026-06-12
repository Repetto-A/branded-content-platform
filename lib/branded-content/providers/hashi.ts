import { FatalError, RetryableError } from "workflow"
import { getHashiApiKey, getHashiWebhookUrl, getHashiWorkflowId } from "@/lib/branded-content/config"
import type {
  CreateCreativeJobInput,
  CreateCreativeJobResult,
  CreativeJobStatus,
  CreativeOutputType,
} from "@/lib/branded-content/types"

function classifyOutputUrl(url: string): "image" | "video" | "json" {
  const normalized = url.toLowerCase()
  if (/\.(mp4|mov|webm|m4v)(\?|$)/.test(normalized)) return "video"
  if (/\.(json)(\?|$)/.test(normalized)) return "json"
  return "image"
}

function collectUrls(value: unknown, found: Set<string> = new Set<string>()): Set<string> {
  if (typeof value === "string" && /^https?:\/\//i.test(value)) {
    found.add(value)
    return found
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectUrls(entry, found))
    return found
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((entry) => collectUrls(entry, found))
  }
  return found
}

export function extractHashiResult(raw: unknown): CreativeJobStatus {
  const payload = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const normalizedStatus = String(payload.status ?? payload.state ?? payload.result ?? "running").toLowerCase()
  const failed =
    normalizedStatus.includes("fail") ||
    normalizedStatus.includes("error") ||
    Boolean(payload.error) ||
    Boolean(payload.errorMessage)

  const outputs: Array<{ type: "image" | "video" | "json"; url?: string; metadata?: Record<string, unknown> }> =
    [...collectUrls(raw)].map((url) => ({
    type: classifyOutputUrl(url),
    url,
  }))

  const slidePlan = payload.slide_plan ?? payload.slidePlan
  if (slidePlan) {
    outputs.push({
      type: "json" as const,
      metadata: { slidePlan },
    })
  }

  return {
    providerStatus: failed ? "failed" : "ready",
    outputs,
    errorMessage: failed ? String(payload.errorMessage ?? payload.error ?? "Hashi execution failed") : undefined,
    raw,
  }
}

async function postHashiWebhook(input: CreateCreativeJobInput): Promise<CreateCreativeJobResult> {
  "use step"

  const workflowId = getHashiWorkflowId(input.outputType)
  const apiKey = getHashiApiKey()
  const webhookUrl = getHashiWebhookUrl(workflowId)
  const providerPayload = {
    user_request: input.brief.userRequest,
    brand_context: input.brief.brandContext,
    reference_assets: input.brief.referenceAssets,
    format: input.brief.format,
    cta: input.brief.cta,
    campaign_context: input.brief.campaignContext,
    callback_url: input.callbackUrl,
    output_type: input.outputType,
    metadata: input.brief.metadata ?? {},
  }

  let response: Response
  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(providerPayload),
    })
  } catch (error) {
    throw new RetryableError(
      `Hashi webhook request failed: ${error instanceof Error ? error.message : "Unknown network error"}`,
    )
  }

  let parsedBody: unknown = null
  try {
    parsedBody = await response.json()
  } catch {
    parsedBody = await response.text().catch(() => null)
  }

  if (!response.ok) {
    const message = `Hashi webhook failed with ${response.status}`
    if (response.status >= 500 || response.status === 429) {
      throw new RetryableError(message)
    }
    throw new FatalError(message)
  }

  const bodyRecord = parsedBody && typeof parsedBody === "object" ? (parsedBody as Record<string, unknown>) : {}
  const returnedStatus = String(bodyRecord.status ?? "").toLowerCase()
  const isImmediateReady = returnedStatus === "ready" || returnedStatus === "completed" || returnedStatus === "success"

  if (isImmediateReady) {
    const finalResult = extractHashiResult(parsedBody)
    return {
      providerExecutionId: typeof bodyRecord.executionId === "string" ? bodyRecord.executionId : undefined,
      providerStatus: finalResult.providerStatus,
      providerPayloadSnapshot: providerPayload,
      providerResponseSnapshot: parsedBody,
      outputs: finalResult.outputs,
      errorMessage: finalResult.errorMessage,
    }
  }

  return {
    providerExecutionId: typeof bodyRecord.executionId === "string" ? bodyRecord.executionId : undefined,
    providerStatus: "running",
    providerPayloadSnapshot: providerPayload,
    providerResponseSnapshot: parsedBody,
  }
}

export class HashiWorkflowProvider {
  async createJob(input: CreateCreativeJobInput) {
    return postHashiWebhook(input)
  }
}

export function getWorkflowConfigForOutputType(outputType: CreativeOutputType) {
  return {
    workflowId: getHashiWorkflowId(outputType),
  }
}
