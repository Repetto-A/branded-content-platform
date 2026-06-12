import type { BrandBundle, CreativeBrief, CreativeRequestInput } from "@/lib/branded-content/types"

export function normalizeCreativeBrief(input: CreativeRequestInput, bundle: BrandBundle) {
  const mustInclude = bundle.profile.contentRules.mustInclude ?? []
  const warnings: string[] = []

  if (mustInclude.some((item) => item.toLowerCase().includes("logo")) && !bundle.brand.logoUrl) {
    warnings.push("Brand requires a logo but no logo asset is configured.")
  }

  const brandContext = {
    voice: [
      ...(bundle.profile.voice.tone ?? []),
      ...(bundle.profile.voice.examples?.length ? [`examples: ${bundle.profile.voice.examples.join(" | ")}`] : []),
    ]
      .filter(Boolean)
      .join(", "),
    visual_style: [
      ...(bundle.profile.visualStyle.mood ?? []),
      ...(bundle.profile.visualStyle.colors?.length ? [`colors: ${bundle.profile.visualStyle.colors.join(", ")}`] : []),
      bundle.profile.visualStyle.typographyNotes ? `type: ${bundle.profile.visualStyle.typographyNotes}` : "",
      bundle.profile.visualStyle.compositionNotes ? `composition: ${bundle.profile.visualStyle.compositionNotes}` : "",
    ]
      .filter(Boolean)
      .join(", "),
    forbidden_styles: bundle.profile.visualStyle.forbiddenStyles ?? [],
    must_include: mustInclude,
    summary: bundle.profile.contextSummary ?? "",
  }

  const selectedReferenceAssets = bundle.assets.filter((asset) =>
    (input.referenceAssetIds ?? []).includes(asset.id) || asset.usage === "always",
  )

  const fallbackReferenceAssets = []
  const hasLogoAsset = selectedReferenceAssets.some((asset) => asset.type === "logo")
  if (!hasLogoAsset && bundle.brand.logoUrl) {
    fallbackReferenceAssets.push({
      type: "logo" as const,
      url: bundle.brand.logoUrl,
      usage: "always" as const,
    })
  }

  const hasMascotAsset = selectedReferenceAssets.some((asset) => asset.type === "mascot" || asset.type === "avatar")
  if (!hasMascotAsset && bundle.brand.mascotAssetUrl) {
    fallbackReferenceAssets.push({
      type: "mascot" as const,
      url: bundle.brand.mascotAssetUrl,
      usage: "provider_reference" as const,
    })
  }

  // Ephemeral per-request reference images: not brand assets, just URLs the
  // user attached for this single piece (e.g. a specific jacket to advertise).
  const requestReferenceAssets = (input.referenceImageUrls ?? []).map((url) => ({
    type: "reference_image" as const,
    url,
    usage: "provider_reference" as const,
  }))

  const referenceAssets = [...requestReferenceAssets, ...selectedReferenceAssets, ...fallbackReferenceAssets].filter(
    (asset, index, assets) => assets.findIndex((candidate) => candidate.url === asset.url && candidate.type === asset.type) === index,
  )

  const brief: CreativeBrief = {
    outputType: input.outputType,
    userRequest: input.userPrompt,
    brandContext,
    referenceAssets: referenceAssets.map((asset) => ({
      type: asset.type,
      url: asset.url,
      usage: asset.usage,
    })),
    format: input.format,
    cta: input.cta,
    campaignContext: input.campaignContext,
    metadata: input.metadata,
  }

  return { brief, warnings }
}
