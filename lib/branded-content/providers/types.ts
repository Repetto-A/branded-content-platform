import type { CreateCreativeJobInput, CreateCreativeJobResult, CreativeJobStatus } from "@/lib/branded-content/types"

export interface CreativeWorkflowProvider {
  createJob(input: CreateCreativeJobInput): Promise<CreateCreativeJobResult>
  getJobStatus?(providerExecutionId: string): Promise<CreativeJobStatus>
  cancelJob?(providerExecutionId: string): Promise<void>
}
