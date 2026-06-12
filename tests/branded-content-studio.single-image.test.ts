import { beforeEach, describe, expect, it, vi } from "vitest"
import { normalizeCreativeBrief } from "@/lib/branded-content/normalizer"
import { HashiWorkflowProvider } from "@/lib/branded-content/providers/hashi"
import type { BrandBundle, CreateCreativeJobInput, CreativeRequestInput } from "@/lib/branded-content/types"

describe("Branded Content Studio - single image branding", () => {
  const vivaBrandBundle: BrandBundle = {
    brand: {
      id: "brand-viva",
      name: "Viva Estudio",
      description: "Creative studio for premium social content",
      websiteUrl: "https://vivaestudio.com",
      logoUrl: "https://cdn.vivaestudio.com/logo-viva.png",
      mascotAssetUrl: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    profile: {
      brandId: "brand-viva",
      voice: {
        tone: ["premium", "editorial", "confident"],
        avoid: ["generic stock tone"],
        examples: ["Viva means visual clarity", "Crafted for social first"],
      },
      visualStyle: {
        mood: ["clean", "cinematic"],
        colors: ["#111111", "#F4D03F"],
        typographyNotes: "High-contrast sans serif",
        compositionNotes: "Centered hero composition",
        forbiddenStyles: ["low contrast", "busy background"],
      },
      contentRules: {
        mustInclude: ["logo", "brand color accents"],
        mustAvoid: ["small unreadable text"],
      },
      contextSummary: "Viva Estudio visual identity",
    },
    assets: [
      {
        id: "asset-logo-viva",
        brandId: "brand-viva",
        type: "logo",
        url: "https://cdn.vivaestudio.com/logo-viva.png",
        label: "Viva logo",
        description: "Primary brand mark",
        usage: "always",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "asset-packshot",
        brandId: "brand-viva",
        type: "reference_image",
        url: "https://cdn.vivaestudio.com/product-packshot.png",
        label: "Product packshot",
        description: null,
        usage: "optional",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.HASHI_API_KEY = "hashi_test_key"
    process.env.HASHI_IMAGE_WORKFLOW_ID = "workflow-image-id"
    process.env.HASHI_VIDEO_WORKFLOW_ID = "workflow-video-id"
    process.env.HASHI_CAROUSEL_WORKFLOW_ID = "workflow-carousel-id"
  })

  it("normalizes branding context and includes logo as reference asset", () => {
    const input: CreativeRequestInput = {
      brandId: vivaBrandBundle.brand.id,
      outputType: "single_image",
      userPrompt: "Create a launch image for Instagram",
      referenceAssetIds: ["asset-packshot"],
      format: "1:1",
      cta: "Book now",
      campaignContext: "Summer launch",
      metadata: { locale: "es-AR" },
    }

    const { brief, warnings } = normalizeCreativeBrief(input, vivaBrandBundle)

    expect(warnings).toEqual([])
    expect(brief.brandContext.voice).toContain("premium")
    expect(brief.brandContext.visual_style).toContain("colors: #111111, #F4D03F")
    expect(brief.brandContext.must_include).toContain("logo")
    expect(brief.referenceAssets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "logo", url: "https://cdn.vivaestudio.com/logo-viva.png" }),
        expect.objectContaining({ type: "reference_image", url: "https://cdn.vivaestudio.com/product-packshot.png" }),
      ]),
    )
  })

  it("sends logo and brand context to provider payload for single image", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "queued",
          executionId: "exec-123",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    )

    vi.stubGlobal("fetch", fetchMock)

    const { brief } = normalizeCreativeBrief(
      {
        brandId: vivaBrandBundle.brand.id,
        outputType: "single_image",
        userPrompt: "Foto producto con branding de Viva Estudio",
        referenceAssetIds: ["asset-packshot"],
      },
      vivaBrandBundle,
    )

    const provider = new HashiWorkflowProvider()
    const input: CreateCreativeJobInput = {
      outputType: "single_image",
      callbackUrl: "https://example.com/callback",
      brief,
    }

    const result = await provider.createJob(input)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const calledBody = JSON.parse(fetchMock.mock.calls[0][1].body as string)

    expect(calledBody.user_request).toContain("Viva Estudio")
    expect(calledBody.brand_context.must_include).toContain("logo")
    expect(calledBody.reference_assets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "logo", url: "https://cdn.vivaestudio.com/logo-viva.png" }),
      ]),
    )
    expect(result.providerPayloadSnapshot).toEqual(calledBody)
  })

  it("warns when brand requires logo but logo asset is missing", () => {
    const bundleWithoutLogoAsset: BrandBundle = {
      ...vivaBrandBundle,
      brand: {
        ...vivaBrandBundle.brand,
        logoUrl: null,
      },
      assets: vivaBrandBundle.assets.filter((asset) => asset.type !== "logo"),
    }

    const { warnings } = normalizeCreativeBrief(
      {
        brandId: bundleWithoutLogoAsset.brand.id,
        outputType: "single_image",
        userPrompt: "Create a single image ad",
      },
      bundleWithoutLogoAsset,
    )

    expect(warnings).toContain("Brand requires a logo but no logo asset is configured.")
  })

  it("uses brand.logoUrl as fallback when no logo asset exists", () => {
    const bundleWithLogoOnlyInBrand: BrandBundle = {
      ...vivaBrandBundle,
      assets: vivaBrandBundle.assets.filter((asset) => asset.type !== "logo"),
    }

    const { brief } = normalizeCreativeBrief(
      {
        brandId: bundleWithLogoOnlyInBrand.brand.id,
        outputType: "single_image",
        userPrompt: "Single image with logo",
      },
      bundleWithLogoOnlyInBrand,
    )

    expect(brief.referenceAssets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "logo", url: "https://cdn.vivaestudio.com/logo-viva.png" }),
      ]),
    )
  })
})
