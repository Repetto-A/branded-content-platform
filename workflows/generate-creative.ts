import { createWebhook, FatalError, sleep } from "workflow"
import { mirrorRemoteAssetToSupabase } from "@/lib/branded-content/blob"
import { HashiWorkflowProvider, extractHashiResult, getWorkflowConfigForOutputType } from "@/lib/branded-content/providers/hashi"
import {
  replaceCreativeOutputs,
  updateCreativeJob,
  updateCreativeRequest,
} from "@/lib/branded-content/repository"
import type { CreateCreativeJobInput, CreativeOutputType } from "@/lib/branded-content/types"

export interface GenerateCreativeWorkflowInput extends CreateCreativeJobInput {
  requestId: string
  jobId: string
}

async function persistQueuedState(input: {
  requestId: string
  jobId: string
  workflowRunId?: string
}) {
  "use step"

  await updateCreativeRequest(input.requestId, {
    status: "queued",
    latestRunId: input.workflowRunId ?? null,
  })
  await updateCreativeJob(input.jobId, {
    status: "queued",
    workflowRunId: input.workflowRunId ?? null,
  })
}

async function persistRunningState(input: {
  requestId: string
  jobId: string
  executionId?: string
  providerPayloadSnapshot: unknown
  workflowRunId?: string
}) {
  "use step"

  await updateCreativeRequest(input.requestId, {
    status: "provider_running",
    latestRunId: input.workflowRunId ?? null,
  })
  await updateCreativeJob(input.jobId, {
    status: "provider_running",
    providerExecutionId: input.executionId ?? null,
    providerPayloadSnapshot: input.providerPayloadSnapshot,
    workflowRunId: input.workflowRunId ?? null,
  })
}

async function persistFailure(input: {
  requestId: string
  jobId: string
  errorMessage: string
  callbackPayload?: unknown
}) {
  "use step"

  await updateCreativeRequest(input.requestId, { status: "failed" })
  await updateCreativeJob(input.jobId, {
    status: "failed",
    errorMessage: input.errorMessage,
    providerCallbackSnapshot: input.callbackPayload,
  })
}

async function persistReadyState(input: {
  requestId: string
  jobId: string
  callbackPayload?: unknown
  outputs: Array<{ type: "image" | "video" | "json"; url?: string; metadata?: Record<string, unknown> }>
}) {
  "use step"

  const persistedOutputs = []
  for (let i = 0; i < input.outputs.length; i++) {
    const output = input.outputs[i]
    let finalUrl = output.url

    if (finalUrl && (output.type === "image" || output.type === "video")) {
      try {
        finalUrl = await mirrorRemoteAssetToSupabase(finalUrl, `creative-output-${input.jobId}-${i + 1}`)
      } catch {
        // keep provider URL if mirroring fails
      }
    }

    persistedOutputs.push({
      type: output.type,
      url: finalUrl,
      previewUrl: finalUrl,
      metadata: output.metadata ?? {},
    })
  }

  await replaceCreativeOutputs(input.jobId, persistedOutputs)
  await updateCreativeRequest(input.requestId, { status: "ready" })
  await updateCreativeJob(input.jobId, {
    status: "ready",
    providerCallbackSnapshot: input.callbackPayload,
    errorMessage: null,
  })
}

/**
 * Vercel Deployment Protection blocks the workflow callback webhook with a 401
 * SSO page, so Hashi can never deliver its result. When "Protection Bypass for
 * Automation" is enabled, Vercel exposes VERCEL_AUTOMATION_BYPASS_SECRET — we
 * append it to the callback URL so the automated POST is allowed through while
 * the rest of the deployment stays protected. No-op when the secret is absent
 * (local dev, or protection disabled).
 */
function withProtectionBypass(url: string) {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  if (!secret) return url
  try {
    const parsed = new URL(url)
    parsed.searchParams.set("x-vercel-protection-bypass", secret)
    parsed.searchParams.set("x-vercel-set-bypass-cookie", "true")
    return parsed.toString()
  } catch {
    return url
  }
}

function getTimeoutForOutputType(outputType: CreativeOutputType) {
  switch (outputType) {
    case "single_image":
      return "10m"
    case "carousel":
      return "20m"
    case "avatar_video":
    case "mascot_video":
      return "25m"
    default:
      return "15m"
  }
}

export async function generateCreativeWorkflow(input: GenerateCreativeWorkflowInput) {
  "use workflow"

  await persistQueuedState({
    requestId: input.requestId,
    jobId: input.jobId,
  })

  const callbackWebhook = createWebhook()

  const provider = new HashiWorkflowProvider()
  const providerResult = await provider.createJob({
    ...input,
    callbackUrl: withProtectionBypass(callbackWebhook.url),
  })

  await persistRunningState({
    requestId: input.requestId,
    jobId: input.jobId,
    executionId: providerResult.providerExecutionId,
    providerPayloadSnapshot: providerResult.providerPayloadSnapshot,
  })

  if (providerResult.providerStatus === "failed") {
    await persistFailure({
      requestId: input.requestId,
      jobId: input.jobId,
      errorMessage: providerResult.errorMessage ?? "Hashi job failed to start",
      callbackPayload: providerResult.providerResponseSnapshot,
    })
    throw new FatalError(providerResult.errorMessage ?? "Hashi job failed to start")
  }

  if (providerResult.providerStatus === "ready" && providerResult.outputs?.length) {
    await persistReadyState({
      requestId: input.requestId,
      jobId: input.jobId,
      callbackPayload: providerResult.providerResponseSnapshot,
      outputs: providerResult.outputs,
    })
    return {
      requestId: input.requestId,
      jobId: input.jobId,
      providerExecutionId: providerResult.providerExecutionId,
      outputs: providerResult.outputs,
      mode: "sync",
      providerWorkflow: getWorkflowConfigForOutputType(input.outputType).workflowId,
    }
  }

  const callbackOrTimeout = await Promise.race([
    callbackWebhook.then(async (request) => {
      const payload = await request.json()
      return { type: "callback" as const, payload }
    }),
    sleep(getTimeoutForOutputType(input.outputType)).then(() => ({ type: "timeout" as const })),
  ])

  if (callbackOrTimeout.type === "timeout") {
    const message = "Hashi callback timed out"
    await persistFailure({
      requestId: input.requestId,
      jobId: input.jobId,
      errorMessage: message,
    })
    throw new FatalError(message)
  }

  const callbackResult = extractHashiResult(callbackOrTimeout.payload)
  if (callbackResult.providerStatus === "failed") {
    await persistFailure({
      requestId: input.requestId,
      jobId: input.jobId,
      errorMessage: callbackResult.errorMessage ?? "Hashi callback reported a failure",
      callbackPayload: callbackOrTimeout.payload,
    })
    throw new FatalError(callbackResult.errorMessage ?? "Hashi callback reported a failure")
  }

  await persistReadyState({
    requestId: input.requestId,
    jobId: input.jobId,
    callbackPayload: callbackOrTimeout.payload,
    outputs: callbackResult.outputs ?? [],
  })

  return {
    requestId: input.requestId,
    jobId: input.jobId,
    providerExecutionId: providerResult.providerExecutionId,
    outputs: callbackResult.outputs ?? [],
    mode: "callback",
    providerWorkflow: getWorkflowConfigForOutputType(input.outputType).workflowId,
  }
}
