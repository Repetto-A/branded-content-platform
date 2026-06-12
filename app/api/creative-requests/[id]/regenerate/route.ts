import { NextResponse } from "next/server"
import { start } from "workflow/api"
import { getHashiWorkflowId } from "@/lib/branded-content/config"
import { normalizeCreativeBrief } from "@/lib/branded-content/normalizer"
import {
  cloneCreativeRequest,
  createCreativeJob,
  getBrandBundle,
  getCreativeRequestDetail,
  updateCreativeJob,
  updateCreativeRequest,
} from "@/lib/branded-content/repository"
import { generateCreativeWorkflow } from "@/workflows/generate-creative"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const cloned = await cloneCreativeRequest(id)
    const detail = await getCreativeRequestDetail(cloned.id)
    const bundle = await getBrandBundle(cloned.brandId)
    const { brief, warnings } = normalizeCreativeBrief(
      {
        brandId: cloned.brandId,
        outputType: cloned.outputType,
        userPrompt: cloned.userPrompt,
        platform: cloned.platform ?? undefined,
        format: cloned.format ?? undefined,
        cta: cloned.cta ?? undefined,
        campaignContext: cloned.campaignContext ?? undefined,
        referenceAssetIds: cloned.referenceAssetIds,
        metadata: cloned.metadata ?? {},
      },
      bundle,
    )

    const createdJob = await createCreativeJob({
      requestId: cloned.id,
      provider: "hashi",
      providerWorkflowId: getHashiWorkflowId(cloned.outputType),
      status: "queued",
    })

    const run = await start(generateCreativeWorkflow, [
      {
        requestId: cloned.id,
        jobId: createdJob.id,
        outputType: cloned.outputType,
        brief,
      },
    ])

    await Promise.all([
      updateCreativeRequest(cloned.id, {
        latestRunId: run.runId,
        status: "queued",
        metadata: {
          ...(cloned.metadata ?? {}),
          warnings,
          regeneratedFrom: id,
        },
      }),
      updateCreativeJob(createdJob.id, {
        workflowRunId: run.runId,
      }),
    ])

    return NextResponse.json({
      request: {
        ...detail.request,
        latestRunId: run.runId,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to regenerate creative request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
