export type CreativeOutputType = "single_image" | "avatar_video" | "mascot_video" | "carousel"

export type CreativeJobStatusValue =
  | "draft"
  | "queued"
  | "provider_running"
  | "ready"
  | "failed"
  | "cancelled"

export type CreativeApprovalStatus = "pending" | "approved"

export type BrandAssetType =
  | "logo"
  | "reference_image"
  | "mascot"
  | "avatar"
  | "brandbook"
  | "website_snapshot"

export type BrandAssetUsage = "always" | "optional" | "provider_reference" | "internal_context"

export interface Brand {
  id: string
  name: string
  description?: string | null
  websiteUrl?: string | null
  logoUrl?: string | null
  mascotAssetUrl?: string | null
  createdAt: string
  updatedAt: string
}

export interface BrandProfile {
  brandId: string
  voice: {
    tone: string[]
    avoid: string[]
    examples?: string[]
  }
  visualStyle: {
    mood: string[]
    colors?: string[]
    typographyNotes?: string
    compositionNotes?: string
    forbiddenStyles: string[]
  }
  contentRules: {
    mustInclude?: string[]
    mustAvoid?: string[]
    ctaStyle?: string
    claimsPolicy?: string
  }
  contextSummary: string
}

export interface BrandAsset {
  id: string
  brandId: string
  type: BrandAssetType
  url: string
  label?: string | null
  description?: string | null
  usage: BrandAssetUsage
  createdAt: string
}

export interface CreativeRequest {
  id: string
  brandId: string
  outputType: CreativeOutputType
  userPrompt: string
  platform?: string | null
  format?: string | null
  cta?: string | null
  campaignContext?: string | null
  referenceAssetIds: string[]
  status: CreativeJobStatusValue
  approvalStatus: CreativeApprovalStatus
  latestRunId?: string | null
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface CreativeJob {
  id: string
  requestId: string
  provider: "hashi" | "custom"
  providerWorkflowId?: string | null
  providerExecutionId?: string | null
  workflowRunId?: string | null
  providerPayloadSnapshot?: unknown
  providerCallbackSnapshot?: unknown
  status: CreativeJobStatusValue
  errorMessage?: string | null
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface CreativeOutput {
  id: string
  jobId: string
  type: "image" | "video" | "json" | "zip" | "pdf"
  url?: string | null
  previewUrl?: string | null
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface BrandBundle {
  brand: Brand
  profile: BrandProfile
  assets: BrandAsset[]
}

export interface CreativeRequestInput {
  brandId: string
  outputType: CreativeOutputType
  userPrompt: string
  platform?: string
  format?: string
  cta?: string
  campaignContext?: string
  referenceAssetIds?: string[]
  /** Ephemeral per-request reference image URLs (not stored as brand assets). */
  referenceImageUrls?: string[]
  metadata?: Record<string, unknown>
}

export interface NormalizedBrandContext {
  voice: string
  visual_style: string
  forbidden_styles: string[]
  must_include: string[]
  summary: string
}

export interface CreativeBrief {
  outputType: CreativeOutputType
  userRequest: string
  brandContext: NormalizedBrandContext
  referenceAssets: Array<{ type: BrandAssetType; url: string; usage: BrandAssetUsage }>
  format?: string
  cta?: string
  campaignContext?: string
  metadata?: Record<string, unknown>
}

export interface CreateCreativeJobInput {
  outputType: CreativeOutputType
  brief: CreativeBrief
  callbackUrl?: string
}

export interface CreateCreativeJobResult {
  providerExecutionId?: string
  providerStatus: "running" | "ready" | "failed"
  providerPayloadSnapshot: unknown
  providerResponseSnapshot: unknown
  outputs?: Array<{ type: "image" | "video" | "json"; url?: string; metadata?: Record<string, unknown> }>
  errorMessage?: string
}

export interface CreativeJobStatus {
  providerStatus: "running" | "ready" | "failed"
  outputs?: Array<{ type: "image" | "video" | "json"; url?: string; metadata?: Record<string, unknown> }>
  errorMessage?: string
  raw?: unknown
}
