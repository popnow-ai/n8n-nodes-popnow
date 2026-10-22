# Changelog

## Unreleased

- Prices follow PopNow's new credit unit: 1 credit = $0.001 (it was $0.01 before 2026-10-19), so prices in
  credits are larger numbers than before (a 5-second MiniMax H3 clip at 768p is 185 credits). The default **Max Credits per Item** is now 2,000 credits,
  the same $2 as before; a limit you typed in yourself keeps its number, so multiply it by ten to keep its
  dollar value. USD amounts without a credit figure are converted at the new rate.

## 0.1.1

- Published from GitHub Actions with npm provenance, as required for n8n verified community nodes.
- The npm README now installs from npm instead of GitHub.

## 0.1.0

First release, published on npm as `n8n-nodes-popnow`.

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
