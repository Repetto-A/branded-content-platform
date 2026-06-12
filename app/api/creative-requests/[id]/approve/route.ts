import { NextResponse } from "next/server"
import { updateCreativeRequest } from "@/lib/branded-content/repository"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await updateCreativeRequest(id, { approvalStatus: "approved" })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to approve creative request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
