# Supabase Migration Verification Checklist

This checklist validates the branded content flow after migrating storage from Vercel Blob to Supabase Storage.

## 1. Preconditions

Required environment variables:

- `AI_GATEWAY_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET=branded-content` (optional if using the default bucket)
- `HASHI_API_KEY`
- `HASHI_IMAGE_WORKFLOW_ID`
- `HASHI_VIDEO_WORKFLOW_ID`
- `HASHI_CAROUSEL_WORKFLOW_ID`

Apply the latest SQL from `supabase/schema.sql` before testing.

## 2. Verify Supabase bucket and policies

Run in Supabase SQL Editor:

```sql
select id, name, public
from storage.buckets
where id = 'branded-content';

select policyname, permissive, roles, cmd
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname in (
    'Public read branded-content objects',
    'Service role manages branded-content objects'
  );
```

Expected result:

- bucket exists with `id = branded-content`
- public read policy exists
- service-role manage policy exists

## 3. Start the app locally

```powershell
pnpm install
pnpm dev
```

Expected result:

- app starts without `BLOB_READ_WRITE_TOKEN` errors
- no server error about missing Blob storage

## 4. Upload a real brand logo

In the Branded Content Studio UI:

1. Open the brand editor for Viva Estudio.
2. Upload the real logo through the brand asset uploader.
3. Mark it as:
   - `type = logo`
   - `usage = always`

Verification SQL:

```sql
select id, brand_id, type, usage, url, created_at
from brand_assets
where type = 'logo'
order by created_at desc;
```

Expected result:

- a new `brand_assets` row exists
- `url` points to the Supabase Storage public URL
- `usage = always`

## 5. Confirm the logo file exists in Storage

In Supabase Dashboard:

1. Go to Storage.
2. Open the `branded-content` bucket.
3. Confirm a file exists under `brand-assets/{brandId}/...`

Expected result:

- uploaded logo is visible
- opening the URL returns the actual image

## 6. Generate a single branded photo

Use a prompt that makes logo usage obvious, for example:

```text
Create a premium Instagram launch image for Viva Estudio. Use the official Viva Estudio logo visibly in the top area and preserve the black and yellow brand accents.
```

Set:

- output type: `single_image`
- include the uploaded logo asset
- include any relevant product/reference asset

Expected result:

- request is created
- job moves from `queued` to `provider_running` to `ready`

Verification SQL:

```sql
select id, brand_id, output_type, status, metadata, created_at
from creative_requests
order by created_at desc
limit 5;

select id, request_id, provider, provider_workflow_id, provider_execution_id, status, provider_payload_snapshot
from creative_jobs
order by created_at desc
limit 5;
```

## 7. Inspect the payload sent to the provider

From the latest row in `creative_jobs.provider_payload_snapshot`, verify:

- `brand_context.must_include` contains `logo`
- `brand_context.visual_style` contains Viva Estudio colors
- `reference_assets` contains the uploaded logo URL
- `user_request` clearly reflects the branded prompt

What to look for specifically:

- if the generated image ignores branding, but payload does include the correct logo URL, the problem is downstream in provider prompting/execution
- if the payload does not include the logo URL, the problem is still in brief normalization or asset selection

## 8. Confirm generated output is mirrored to Supabase

Verification SQL:

```sql
select id, job_id, type, url, preview_url, metadata, created_at
from creative_outputs
order by created_at desc
limit 10;
```

Expected result:

- output row exists for the generated image
- `url` and `preview_url` point to Supabase public URLs

In Supabase Storage, verify a file exists under:

- `creative-outputs/...` for provider-mirrored outputs
- `generated-images/...` for direct generation workflow outputs

## 9. Visual acceptance check

Open the final generated image and validate:

- the logo is actually the Viva Estudio logo
- black/yellow brand accents are present if requested
- composition matches the brief
- the result does not look like a generic unbranded stock ad

If branding is wrong, classify the defect:

- `Payload bug`: wrong or missing logo/reference assets in `provider_payload_snapshot`
- `Provider interpretation bug`: payload is correct but image ignores the brand
- `Asset setup bug`: wrong logo uploaded or wrong asset marked as `always`

## 10. Regression checks

Run tests:

```powershell
pnpm test
```

Expected result:

- branded content tests pass
- one expected-fail test may remain if logo fallback from `brand.logoUrl` to reference assets has not yet been implemented

## 11. Recommended next fix if logo is still ignored

If the payload is correct and the output still ignores the brand, the next technical step is:

1. enrich the provider prompt with a stronger instruction hierarchy for logo placement
2. send the logo as a first-class required reference asset
3. add a post-generation review gate that flags outputs where the logo is missing or clearly wrong