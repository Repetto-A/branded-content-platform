import { getSupabaseServerClient } from "@/lib/supabase/server"
import type {
  Brand,
  BrandAsset,
  BrandBundle,
  BrandProfile,
  CreativeApprovalStatus,
  CreativeJob,
  CreativeJobStatusValue,
  CreativeOutput,
  CreativeRequest,
  CreativeRequestInput,
} from "@/lib/branded-content/types"

function mapBrand(row: any): Brand {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    websiteUrl: row.website_url,
    logoUrl: row.logo_url,
    mascotAssetUrl: row.mascot_asset_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapBrandProfile(row: any, brandId?: string): BrandProfile {
  return {
    brandId: row?.brand_id ?? brandId ?? "",
    voice: row?.voice ?? { tone: [], avoid: [] },
    visualStyle: row?.visual_style ?? { mood: [], forbiddenStyles: [] },
    contentRules: row?.content_rules ?? {},
    contextSummary: row?.context_summary ?? "",
  }
}

function mapBrandAsset(row: any): BrandAsset {
  return {
    id: row.id,
    brandId: row.brand_id,
    type: row.type,
    url: row.url,
    label: row.label,
    description: row.description,
    usage: row.usage,
    createdAt: row.created_at,
  }
}

function mapCreativeRequest(row: any): CreativeRequest {
  return {
    id: row.id,
    brandId: row.brand_id,
    outputType: row.output_type,
    userPrompt: row.user_prompt,
    platform: row.platform,
    format: row.format,
    cta: row.cta,
    campaignContext: row.campaign_context,
    referenceAssetIds: Array.isArray(row.reference_asset_ids) ? row.reference_asset_ids : [],
    status: row.status,
    approvalStatus: row.approval_status,
    latestRunId: row.latest_run_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapCreativeJob(row: any): CreativeJob {
  return {
    id: row.id,
    requestId: row.request_id,
    provider: row.provider,
    providerWorkflowId: row.provider_workflow_id,
    providerExecutionId: row.provider_execution_id,
    workflowRunId: row.workflow_run_id,
    providerPayloadSnapshot: row.provider_payload_snapshot,
    providerCallbackSnapshot: row.provider_callback_snapshot,
    status: row.status,
    errorMessage: row.error_message,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapCreativeOutput(row: any): CreativeOutput {
  return {
    id: row.id,
    jobId: row.job_id,
    type: row.type,
    url: row.url,
    previewUrl: row.preview_url,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }
}

export async function ensureDefaultBrand() {
  const supabase = getSupabaseServerClient()
  const { data: existing, error: existingError } = await supabase.from("brands").select("*").limit(1)
  if (existingError) throw existingError
  if (existing && existing.length > 0) return mapBrand(existing[0])

  const now = new Date().toISOString()
  const { data: brandRow, error: brandError } = await supabase
    .from("brands")
    .insert({
      name: "Default Brand",
      description: "Seed brand for the single-workspace MVP.",
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single()
  if (brandError) throw brandError

  const { error: profileError } = await supabase.from("brand_profiles").insert({
    brand_id: brandRow.id,
    voice: { tone: ["clear", "premium", "direct"], avoid: ["generic hype"] },
    visual_style: {
      mood: ["editorial", "clean", "modern"],
      forbiddenStyles: ["generic stock photo", "random neon gradients"],
    },
    content_rules: { mustInclude: ["logo when applicable"] },
    context_summary: "Seed brand profile for MVP testing.",
    created_at: now,
    updated_at: now,
  })
  if (profileError) throw profileError

  return mapBrand(brandRow)
}

export async function listBrands() {
  await ensureDefaultBrand()
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase.from("brands").select("*").order("created_at", { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapBrand)
}

export async function getBrandBundle(brandId: string): Promise<BrandBundle> {
  const supabase = getSupabaseServerClient()
  const [{ data: brandRow, error: brandError }, { data: profileRow, error: profileError }, { data: assetsRows, error: assetsError }] =
    await Promise.all([
      supabase.from("brands").select("*").eq("id", brandId).single(),
      supabase.from("brand_profiles").select("*").eq("brand_id", brandId).maybeSingle(),
      supabase.from("brand_assets").select("*").eq("brand_id", brandId).order("created_at", { ascending: false }),
    ])

  if (brandError) throw brandError
  if (profileError) throw profileError
  if (assetsError) throw assetsError

  return {
    brand: mapBrand(brandRow),
    profile: mapBrandProfile(profileRow, brandId),
    assets: (assetsRows ?? []).map(mapBrandAsset),
  }
}

export async function createBrand(input: Partial<Brand> & { name: string }) {
  const supabase = getSupabaseServerClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("brands")
    .insert({
      name: input.name,
      description: input.description ?? null,
      website_url: input.websiteUrl ?? null,
      logo_url: input.logoUrl ?? null,
      mascot_asset_url: input.mascotAssetUrl ?? null,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single()
  if (error) throw error
  await supabase.from("brand_profiles").insert({
    brand_id: data.id,
    voice: { tone: [], avoid: [] },
    visual_style: { mood: [], forbiddenStyles: [] },
    content_rules: {},
    context_summary: "",
    created_at: now,
    updated_at: now,
  })
  return mapBrand(data)
}

export async function updateBrandBundle(
  brandId: string,
  input: {
    brand: Partial<Brand>
    profile: Partial<BrandProfile>
  },
) {
  const supabase = getSupabaseServerClient()
  const now = new Date().toISOString()
  const brandUpdate = {
    ...(input.brand.name !== undefined ? { name: input.brand.name } : {}),
    ...(input.brand.description !== undefined ? { description: input.brand.description } : {}),
    ...(input.brand.websiteUrl !== undefined ? { website_url: input.brand.websiteUrl } : {}),
    ...(input.brand.logoUrl !== undefined ? { logo_url: input.brand.logoUrl } : {}),
    ...(input.brand.mascotAssetUrl !== undefined ? { mascot_asset_url: input.brand.mascotAssetUrl } : {}),
    updated_at: now,
  }

  const profileUpdate = {
    ...(input.profile.voice !== undefined ? { voice: input.profile.voice } : {}),
    ...(input.profile.visualStyle !== undefined ? { visual_style: input.profile.visualStyle } : {}),
    ...(input.profile.contentRules !== undefined ? { content_rules: input.profile.contentRules } : {}),
    ...(input.profile.contextSummary !== undefined ? { context_summary: input.profile.contextSummary } : {}),
    updated_at: now,
  }

  const { error: brandError } = await supabase.from("brands").update(brandUpdate).eq("id", brandId)
  if (brandError) throw brandError

  const { error: profileError } = await supabase
    .from("brand_profiles")
    .upsert({
      brand_id: brandId,
      ...profileUpdate,
      created_at: now,
    })
  if (profileError) throw profileError

  return getBrandBundle(brandId)
}

export async function createBrandAsset(input: Omit<BrandAsset, "id" | "createdAt">) {
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from("brand_assets")
    .insert({
      brand_id: input.brandId,
      type: input.type,
      url: input.url,
      label: input.label ?? null,
      description: input.description ?? null,
      usage: input.usage,
    })
    .select("*")
    .single()
  if (error) throw error
  return mapBrandAsset(data)
}

/** Extracts the storage object path from a public Supabase Storage URL. */
function storagePathFromPublicUrl(url: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`
  const index = url.indexOf(marker)
  if (index === -1) return null
  return decodeURIComponent(url.slice(index + marker.length))
}

export async function deleteBrandAsset(assetId: string) {
  const supabase = getSupabaseServerClient()
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "branded-content"

  const { data: row, error: fetchError } = await supabase
    .from("brand_assets")
    .select("*")
    .eq("id", assetId)
    .single()
  if (fetchError) throw fetchError

  const asset = mapBrandAsset(row)

  // Best-effort: remove the underlying storage object when it lives in our bucket.
  const objectPath = storagePathFromPublicUrl(asset.url, bucket)
  if (objectPath) {
    await supabase.storage.from(bucket).remove([objectPath])
  }

  // Clear brand logo/mascot pointers if they referenced this exact asset.
  const { data: brandRow } = await supabase.from("brands").select("*").eq("id", asset.brandId).single()
  if (brandRow) {
    const patch: Record<string, unknown> = {}
    if (brandRow.logo_url === asset.url) patch.logo_url = null
    if (brandRow.mascot_asset_url === asset.url) patch.mascot_asset_url = null
    if (Object.keys(patch).length > 0) {
      patch.updated_at = new Date().toISOString()
      await supabase.from("brands").update(patch).eq("id", asset.brandId)
    }
  }

  const { error: deleteError } = await supabase.from("brand_assets").delete().eq("id", assetId)
  if (deleteError) throw deleteError

  return getBrandBundle(asset.brandId)
}

export async function createCreativeRequest(input: CreativeRequestInput) {
  const supabase = getSupabaseServerClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("creative_requests")
    .insert({
      brand_id: input.brandId,
      output_type: input.outputType,
      user_prompt: input.userPrompt,
      platform: input.platform ?? null,
      format: input.format ?? null,
      cta: input.cta ?? null,
      campaign_context: input.campaignContext ?? null,
      reference_asset_ids: input.referenceAssetIds ?? [],
      status: "queued",
      approval_status: "pending",
      metadata: input.metadata ?? {},
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single()
  if (error) throw error
  return mapCreativeRequest(data)
}

export async function createCreativeJob(input: {
  requestId: string
  provider: "hashi" | "custom"
  providerWorkflowId?: string | null
  status?: CreativeJobStatusValue
  providerPayloadSnapshot?: unknown
  workflowRunId?: string | null
}) {
  const supabase = getSupabaseServerClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("creative_jobs")
    .insert({
      request_id: input.requestId,
      provider: input.provider,
      provider_workflow_id: input.providerWorkflowId ?? null,
      workflow_run_id: input.workflowRunId ?? null,
      provider_payload_snapshot: input.providerPayloadSnapshot ?? null,
      status: input.status ?? "queued",
      metadata: {},
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single()
  if (error) throw error
  return mapCreativeJob(data)
}

export async function updateCreativeRequest(
  requestId: string,
  patch: Partial<{
    status: CreativeJobStatusValue
    approvalStatus: CreativeApprovalStatus
    latestRunId: string | null
    metadata: Record<string, unknown>
  }>,
) {
  const supabase = getSupabaseServerClient()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.status !== undefined) update.status = patch.status
  if (patch.approvalStatus !== undefined) update.approval_status = patch.approvalStatus
  if (patch.latestRunId !== undefined) update.latest_run_id = patch.latestRunId
  if (patch.metadata !== undefined) update.metadata = patch.metadata
  const { error } = await supabase.from("creative_requests").update(update).eq("id", requestId)
  if (error) throw error
}

export async function updateCreativeJob(
  jobId: string,
  patch: Partial<{
    providerExecutionId: string | null
    workflowRunId: string | null
    providerPayloadSnapshot: unknown
    providerCallbackSnapshot: unknown
    status: CreativeJobStatusValue
    errorMessage: string | null
    metadata: Record<string, unknown>
  }>,
) {
  const supabase = getSupabaseServerClient()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.providerExecutionId !== undefined) update.provider_execution_id = patch.providerExecutionId
  if (patch.workflowRunId !== undefined) update.workflow_run_id = patch.workflowRunId
  if (patch.providerPayloadSnapshot !== undefined) update.provider_payload_snapshot = patch.providerPayloadSnapshot
  if (patch.providerCallbackSnapshot !== undefined) update.provider_callback_snapshot = patch.providerCallbackSnapshot
  if (patch.status !== undefined) update.status = patch.status
  if (patch.errorMessage !== undefined) update.error_message = patch.errorMessage
  if (patch.metadata !== undefined) update.metadata = patch.metadata
  const { error } = await supabase.from("creative_jobs").update(update).eq("id", jobId)
  if (error) throw error
}

export async function replaceCreativeOutputs(
  jobId: string,
  outputs: Array<{ type: string; url?: string | null; previewUrl?: string | null; metadata?: Record<string, unknown> }>,
) {
  const supabase = getSupabaseServerClient()
  const { error: deleteError } = await supabase.from("creative_outputs").delete().eq("job_id", jobId)
  if (deleteError) throw deleteError
  if (outputs.length === 0) return
  const { error } = await supabase.from("creative_outputs").insert(
    outputs.map((output) => ({
      job_id: jobId,
      type: output.type,
      url: output.url ?? null,
      preview_url: output.previewUrl ?? output.url ?? null,
      metadata: output.metadata ?? {},
    })),
  )
  if (error) throw error
}

export async function listCreativeRequests(brandId?: string) {
  const supabase = getSupabaseServerClient()
  let query = supabase.from("creative_requests").select("*").order("created_at", { ascending: false })
  if (brandId) query = query.eq("brand_id", brandId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(mapCreativeRequest)
}

export async function getCreativeRequestDetail(requestId: string) {
  const supabase = getSupabaseServerClient()
  const { data: requestRow, error: requestError } = await supabase
    .from("creative_requests")
    .select("*")
    .eq("id", requestId)
    .single()
  if (requestError) throw requestError

  const request = mapCreativeRequest(requestRow)
  const bundle = await getBrandBundle(request.brandId)

  const { data: jobsRows, error: jobsError } = await supabase
    .from("creative_jobs")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false })
  if (jobsError) throw jobsError

  const jobs = (jobsRows ?? []).map(mapCreativeJob)
  const latestJob = jobs[0] ?? null

  let outputs: CreativeOutput[] = []
  if (latestJob) {
    const { data: outputRows, error: outputsError } = await supabase
      .from("creative_outputs")
      .select("*")
      .eq("job_id", latestJob.id)
      .order("created_at", { ascending: true })
    if (outputsError) throw outputsError
    outputs = (outputRows ?? []).map(mapCreativeOutput)
  }

  return {
    brand: bundle.brand,
    profile: bundle.profile,
    assets: bundle.assets,
    request,
    jobs,
    latestJob,
    outputs,
  }
}

export async function cloneCreativeRequest(requestId: string) {
  const detail = await getCreativeRequestDetail(requestId)
  const cloned = await createCreativeRequest({
    brandId: detail.request.brandId,
    outputType: detail.request.outputType,
    userPrompt: detail.request.userPrompt,
    platform: detail.request.platform ?? undefined,
    format: detail.request.format ?? undefined,
    cta: detail.request.cta ?? undefined,
    campaignContext: detail.request.campaignContext ?? undefined,
    referenceAssetIds: detail.request.referenceAssetIds,
    metadata: detail.request.metadata ?? {},
  })
  return cloned
}
