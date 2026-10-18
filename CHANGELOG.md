# Changelog

## 0.1.0

First release (install from GitHub; the npm release is coming).

- **PopNow** node with Image, Video and Audio > Generate: model picker with credit prices, prompt, media
  inputs from binary data or URLs (uploaded automatically), a parameter form generated from each model's
  input schema, and a JSON box for anything else.
- A quote before every item, with a per-item credit limit (default 200 credits) that stops before anything
  is charged; `quoteId` and `expectedCredits` lock the quoted price on `createTask`.
- Deterministic `Idempotency-Key` per execution, node, item and input, so retries never create a second task.
- Waiting with server-side wait for image and audio and backoff polling for video; optional download of
  results as binary data.
- Task > Get and Task > Retry, File > Upload, Model > Get / Get Many / Get Quote, Account > Get Balance.
- **PopNow API** credential (API key + base URL) tested against the free balance endpoint.
- `examples/http-request-workflow.json`: the same flow with built-in HTTP Request nodes, for n8n Cloud.
- A `release` branch with the built package, kept in step with `main` by GitHub Actions.
