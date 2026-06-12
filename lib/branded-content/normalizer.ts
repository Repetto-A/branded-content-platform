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

  const brief: CreativeBrief = {
    outputType: input.outputType,
    userRequest: input.userPrompt,
    brandContext,
    referenceAssets: selectedReferenceAssets.map((asset) => ({
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
