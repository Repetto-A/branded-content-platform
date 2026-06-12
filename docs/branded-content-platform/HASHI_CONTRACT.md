# Hashi contract spike

## Workflow tested

- Workflow URL: `https://www.hashiapp.com/api/workflows/872ade95-bdc2-4384-92c7-3310c0cb9db2/webhook`
- Auth: `Authorization` header with API key created in Hashi

## Real observed response

Webhook POST returned:

- HTTP `200`
- JSON body:

```json
{
  "executionId": "5f42ac8a-659b-4a48-98e3-ccb8736bec38",
  "status": "running"
}
```

## Decision

Hashi is **asynchronous**, not synchronous.

The implementation uses **callback-based completion**:

1. The durable workflow creates a Vercel Workflow webhook URL with `createWebhook()`.
2. The app sends that URL to Hashi as `callback_url`.
3. Hashi uses an `HTTP Request` node to POST final execution data back to the workflow webhook.
4. The workflow resumes, persists outputs, and completes.

## Current assumptions for callback payload

Because the exact final callback payload is configurable in Hashi, the app accepts a flexible JSON body and extracts:

- `status`
- `executionId`
- known `imageUrl` / `videoUrl` / URL-like fields
- optional `slide_plan` / `slidePlan`
- optional `error` / `errorMessage`

This keeps the integration resilient while the Hashi workflow is refined.
