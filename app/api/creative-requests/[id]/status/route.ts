import { NextRequest, NextResponse } from "next/server"
import { getRun } from "workflow/api"
import { getCreativeRequestDetail } from "@/lib/branded-content/repository"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const detail = await getCreativeRequestDetail(id)
    let workflowStatus: string | null = null
    let workflowResult: unknown = null

    if (detail.latestJob?.workflowRunId) {
      try {
        const run = getRun(detail.latestJob.workflowRunId)
        workflowStatus = await run.status
        if (workflowStatus === "completed") {
          workflowResult = await run.returnValue
        }
      } catch {
        workflowStatus = null
      }
    }

    return NextResponse.json({
      request: detail.request,
      brand: detail.brand,
      profile: detail.profile,
      latestJob: detail.latestJob,
      jobs: detail.jobs,
      outputs: detail.outputs,
      workflowStatus,
      workflowResult,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch creative request status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
