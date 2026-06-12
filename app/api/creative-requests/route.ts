import { NextRequest, NextResponse } from "next/server"
import { start } from "workflow/api"
import { getHashiWorkflowId } from "@/lib/branded-content/config"
import { normalizeCreativeBrief } from "@/lib/branded-content/normalizer"
import {
  createCreativeJob,
  createCreativeRequest,
  getBrandBundle,
  listCreativeRequests,
  updateCreativeJob,
  updateCreativeRequest,
} from "@/lib/branded-content/repository"
import type { CreativeRequestInput, CreativeOutputType } from "@/lib/branded-content/types"
import { generateCreativeWorkflow } from "@/workflows/generate-creative"

export const maxDuration = 120

function isCreativeOutputType(value: string): value is CreativeOutputType {
  return ["single_image", "avatar_video", "mascot_video", "carousel"].includes(value)
}

export async function GET(request: NextRequest) {
  try {
    const brandId = request.nextUrl.searchParams.get("brandId") ?? undefined
    const requests = await listCreativeRequests(brandId)
    return NextResponse.json({ requests })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to list creative requests", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreativeRequestInput
    if (!body.brandId || !body.userPrompt || !body.outputType) {
      return NextResponse.json({ error: "brandId, outputType and userPrompt are required" }, { status: 400 })
    }
    if (!isCreativeOutputType(body.outputType)) {
      return NextResponse.json({ error: "Unsupported outputType" }, { status: 400 })
    }

    // Fail fast on required provider config
    getHashiWorkflowId(body.outputType)

    const bundle = await getBrandBundle(body.brandId)
    const { brief, warnings } = normalizeCreativeBrief(body, bundle)

    const createdRequest = await createCreativeRequest({
      ...body,
      metadata: {
        ...(body.metadata ?? {}),
        warnings,
        ...(body.referenceImageUrls?.length ? { referenceImageUrls: body.referenceImageUrls } : {}),
      },
    })

    const createdJob = await createCreativeJob({
      requestId: createdRequest.id,
      provider: "hashi",
      providerWorkflowId: getHashiWorkflowId(body.outputType),
      status: "queued",
    })

    const run = await start(generateCreativeWorkflow, [
      {
        requestId: createdRequest.id,
        jobId: createdJob.id,
        outputType: body.outputType,
        brief,
      },
    ])

    await Promise.all([
      updateCreativeRequest(createdRequest.id, {
        latestRunId: run.runId,
        status: "queued",
        metadata: {
          ...(createdRequest.metadata ?? {}),
          warnings,
        },
      }),
      updateCreativeJob(createdJob.id, {
        workflowRunId: run.runId,
      }),
    ])

    return NextResponse.json({
      requestId: createdRequest.id,
      runId: run.runId,
      warnings,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create creative request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
