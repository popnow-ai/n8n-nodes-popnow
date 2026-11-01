<p align="center">
  <a href="https://popnow.ai">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="assets/popnow-wordmark-dark.png">
      <source media="(prefers-color-scheme: light)" srcset="assets/popnow-wordmark.png">
      <img alt="PopNow" src="assets/popnow-wordmark.png" width="280">
    </picture>
  </a>
</p>

<h1 align="center">PopNow n8n Node — AI Video, Image &amp; Music Generation in n8n Workflows</h1>

<p align="center">
  <strong><code>n8n-nodes-popnow</code> is the n8n community node for PopNow</strong>, a single API for AI
  video, image, music and speech generation with models such as Kling, Seedance, Wan, Vidu, MiniMax,
  Nano Banana, GPT Image, Flux and Suno, quoted before every run and paid in US dollars from your PopNow
  API balance.
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <img alt="TypeScript" src="https://img.shields.io/badge/language-TypeScript-3178c6.svg">
  <img alt="n8n community node" src="https://img.shields.io/badge/n8n-community%20node-ea4b71.svg">
  <a href="https://popnow.ai"><img alt="Website" src="https://img.shields.io/badge/site-popnow.ai-ff5c8a.svg"></a>
  <a href="https://popnow.ai/docs"><img alt="Docs" src="https://img.shields.io/badge/docs-popnow.ai%2Fdocs-111.svg"></a>
</p>

PopNow is a browser-based AI studio for videos, images and music: image-to-video, text-to-video, AI images,
music and speech, one-tap trending video effects and image styles. This node brings the PopNow developer API
and its models into [n8n](https://n8n.io): pick a model, fill in a form generated from its schema, and get the
finished file back as n8n binary data. Runs are paid in US dollars from your prepaid PopNow API balance, which
is separate from popnow.ai website credits; add funds at
[popnow.ai/api/console/billing](https://popnow.ai/api/console/billing).

> **Install status:** the npm release (and with it one-click install from n8n's **Community nodes** screen)
> is coming. Until then, install it manually from GitHub as shown below, or use the
> [HTTP Request workflow](#alternative-http-request-workflow-no-install) that needs no install at all.

- [Quickstart](#quickstart)
- [Installation](#installation)
- [Credentials](#credentials)
- [Operations](#operations)
- [Generating images, video and audio](#generating-images-video-and-audio)
- [Spending limits and retries](#spending-limits-and-retries)
- [Long-running tasks](#long-running-tasks)
- [Errors](#errors)
- [Alternative: HTTP Request workflow (no install)](#alternative-http-request-workflow-no-install)
- [FAQ](#faq)
- [Development](#development)

## Quickstart

**1. Install** the node on self-hosted n8n: open **Settings > Community Nodes > Install**, enter
`n8n-nodes-popnow` and confirm. Or from a shell, then restart n8n:

```bash
mkdir -p ~/.n8n/nodes && cd ~/.n8n/nodes
npm install n8n-nodes-popnow
```

**2. Connect** your account: create a **PopNow API** credential with a key from
[popnow.ai/api/console/keys](https://popnow.ai/api/console/keys) (`sk-popnow-...`), and add funds to your API
balance at [popnow.ai/api/console/billing](https://popnow.ai/api/console/billing).

**3. Generate:** add the **PopNow** node, choose **Image > Generate**, pick
`alibaba/z-image-turbo/text-to-image` (about $0.01), type a prompt and run it. The image arrives in the
`data` binary field, ready for Google Drive, S3, Slack or any other node.

## Installation

Unverified community nodes run on **self-hosted** n8n. On n8n Cloud, use the
[HTTP Request workflow](#alternative-http-request-workflow-no-install) instead.

The package is on npm as [`n8n-nodes-popnow`](https://www.npmjs.com/package/n8n-nodes-popnow). The easiest
way in is **Settings > Community Nodes > Install** in the n8n editor; the shell and Docker methods below do
the same thing.

### npm / bare-metal n8n

```bash
mkdir -p ~/.n8n/nodes && cd ~/.n8n/nodes
npm install n8n-nodes-popnow
# then restart n8n
```

n8n loads every `n8n-nodes-*` package in `~/.n8n/nodes/node_modules` at startup. In queue mode, install it
the same way on the main instance and on every worker. To update, run the same `npm install` again and
restart. To remove it, run `npm uninstall n8n-nodes-popnow` in the same folder.

### Docker: install into a running container

The official image keeps `~/.n8n` on the `/home/node/.n8n` volume, so a package installed there survives
image upgrades:

```bash
docker exec -it n8n sh -c 'mkdir -p ~/.n8n/nodes && cd ~/.n8n/nodes && npm install n8n-nodes-popnow'
docker restart n8n
```

Replace `n8n` with your container name.

### Docker: custom image

To bake the node into an image instead, install it outside the `~/.n8n` volume and point
`N8N_CUSTOM_EXTENSIONS` at it:

```dockerfile
FROM n8nio/n8n:latest

USER root
RUN mkdir -p /opt/n8n-custom-nodes \
 && cd /opt/n8n-custom-nodes \
 && npm init -y > /dev/null \
 && npm install --omit=dev n8n-nodes-popnow \
 && chown -R node:node /opt/n8n-custom-nodes
USER node

ENV N8N_CUSTOM_EXTENSIONS=/opt/n8n-custom-nodes/node_modules/n8n-nodes-popnow
```

```bash
docker build -t n8n-popnow .
docker run -it --rm -p 5678:5678 -v n8n_data:/home/node/.n8n n8n-popnow
```

n8n registers nodes from custom extension folders under its custom prefix, so use one install method per
instance and keep it; workflows reference the node by that registered name.

### Build from source

```bash
git clone https://github.com/popnow-ai/n8n-nodes-popnow.git
cd n8n-nodes-popnow
npm ci && npm run build && npm pack          # creates n8n-nodes-popnow-<version>.tgz
cd ~/.n8n/nodes && npm install /path/to/n8n-nodes-popnow/n8n-nodes-popnow-<version>.tgz
```

### From npm (coming)

Once the package is on npm, you will be able to install it from **Settings > Community nodes > Install**
by entering `n8n-nodes-popnow`.

## Credentials

Create a **PopNow API** credential:

| Field | Value |
| --- | --- |
| API Key | A key from [popnow.ai/api/console/keys](https://popnow.ai/api/console/keys). It starts with `sk-popnow-`. |
| Base URL | Leave `https://api.popnow.ai` unless PopNow support tells you otherwise. |

Saving the credential checks the key by reading your API balance (`GET /api/v1/chat/credit`; the path name
is historical and has nothing to do with chat), which is free.
Give n8n its own key with a spend cap in the API console: automations can run far more often than a person
clicks.

## Operations

| Resource | Operation | What it does | API call |
| --- | --- | --- | --- |
| Image | Generate | Text to image, image editing, upscaling, background removal and other image models | `jobs/quote`, `jobs/createTask`, `jobs/recordInfo` |
| Video | Generate | Text to video, image to video, video extend and other video models | same |
| Audio | Generate | Text to speech, music and other audio models | same |
| Task | Get | Read a task by ID, optionally wait for it and download its files | `GET /api/v1/jobs/recordInfo` |
| Task | Retry | Create a new task from a failed or expired one, optionally wait and download | `POST /api/v1/jobs/retry` |
| File | Upload | Upload a binary file and get a `popnow://f/...` URI to use as model input | `common/upload-url`, PUT, `files/{id}/commit` |
| Model | Get Many | The model catalogue with USD rates (`usd`), filtered by modality and keyword | `GET /api/v1/models` |
| Model | Get | One model with its input schema, examples and USD rates | `GET /api/v1/models/{model}` |
| Model | Get Quote | The exact price of a request in USD (`maxChargeUsd`, `expectedChargeUsd`), without running it | `POST /api/v1/jobs/quote` |
| Account | Get Balance | Available, held and total API balance in USD (`availableUsd`, `heldUsd`, `totalUsd`) | `GET /api/v1/chat/credit` |

USD amounts (`maxChargeUsd`, `costUsd`, `availableUsd` and so on) are exact decimal strings. Responses also
carry older `*Credits` fields: a deprecated projection at 1 credit = $0.001, kept for compatibility. Read
the USD fields in new workflows.

The node is marked **usable as a tool**, so an n8n AI Agent can call it too.

### Example models

Every image, video and audio model on PopNow works with the same node. A model ID is
`<maker>/<model>/<task>`; the model picker lists the live catalogue with prices.

| Kind | Example model IDs |
| --- | --- |
| Text to image | `alibaba/z-image-turbo/text-to-image`, `google/nano-banana-2.1/text-to-image`, `openai/gpt-image-2/text-to-image`, `black-forest-labs/flux-2-dev/text-to-image` |
| Image editing | `google/nano-banana-2.1/edit`, `alibaba/qwen-image-2.1/edit`, `popnow/background-remover-v1/edit`, `popnow/image-upscaler-v1/upscale` |
| Image to video | `kling/3.0/image-to-video`, `minimax/h3/image-to-video`, `alibaba/wan-3.0/image-to-video`, `bytedance/seedance-1.5-pro/image-to-video` |
| Text to video | `kling/3.0/text-to-video`, `alibaba/wan-3.0/text-to-video`, `minimax/h3/text-to-video` |
| Music and speech | `suno/v6/text-to-audio`, `google/gemini-3.8-flash-tts/text-to-speech`, `alibaba/qwen-3-tts/text-to-speech` |

## Generating images, video and audio

1. **Model**: pick from the list (models of the selected resource with their starting price; this version
   of the node shows it in credits, where 1 credit = $0.001) or enter a model ID. Every model, its fields and
   USD price are listed at [popnow.ai/api/models](https://popnow.ai/api/models).
2. **Prompt**: the model's main text input. For speech models this is the text to speak. Leave it empty for
   models without a prompt, such as upscalers.
3. **Media Inputs**: images, videos or audio the model reads. Pick the field (the list shows the selected
   model's file inputs), then either a binary field from the previous node or a URL: a public `https://`
   link, a `popnow://f/...` URI from **File > Upload**, or a `popnow://a/...` URI of a saved asset. Binary
   files are uploaded automatically. Add several inputs for the same field to fill list fields such as
   reference images.
4. **Model Parameters**: a form generated from the model's input schema (aspect ratio, resolution, duration,
   seed and so on). Fields left empty are not sent, so the model uses its own default.
5. **Additional Parameters (JSON)**: any other input fields as a JSON object. They override the fields above.

The output is the task record (`taskId`, `state`, `costUsd`, `settled`, `output`; `costUsd` is the USD hold
while `settled` is false and the final USD charge once it is true) and, with
**Download Output** on (the default), the files as binary data in `data`, `data_1` and so on. Links in
`output.assets[].url` expire after about 20 minutes; the binary copies do not.

Large videos are held in memory unless n8n stores binary data on disk. On self-hosted n8n, set
`N8N_DEFAULT_BINARY_DATA_MODE=filesystem` when you work with video.

## Spending limits and retries

- **Every item is priced first.** The node calls `jobs/quote`, and when the quote's maximum is above
  **Max Credits per Item** it stops with an error before anything is created. Nothing is charged. The limit
  is set in credits, where 1 credit = $0.001 of API balance: the default of 2,000 is $2.00 per item, and 0
  removes the limit.
- **The task is created at the quoted price.** The node sends the `quoteId` with `createTask`, together with
  the quote's maximum as `expectedCredits` (the API's credit projection of `maxChargeUsd`, rounded up). If the
  price changed in between (code `40901`), it quotes again, checks the limit again and resubmits under the
  same key. Calling the API yourself? Confirm with `expectedCostUsd` set to the quote's `maxChargeUsd`, as in
  the [billing guide](https://popnow.ai/docs/billing).
- **Retries never charge twice.** Each item is sent with an `Idempotency-Key` derived from the execution, the
  node, the item and its input. When n8n retries the node (Retry On Fail) or a request times out and is
  resent, PopNow returns the task it already created. A new execution, a changed input or another loop pass
  is new work and gets a new key.
- **Failed runs are not charged.** Failed and expired tasks release their USD hold back to your API balance.
  See [API balance and refunds](https://popnow.ai/docs/api-balance-and-refunds).
- **Retention:** the **Retention (Seconds)** option sends `X-PopNow-Retention` to delete a task's prompt and
  files sooner than your account default.

## Long-running tasks

By default the node waits for the result: image and audio models usually answer within one request (the node
asks the API to hold the connection for up to 50 seconds), and video is polled with backoff until the task's
own deadline. Set **Max Wait Time** to stop earlier. When the node stops waiting, the task keeps running and
is charged if it succeeds, so fetch it later with **Task > Get** instead of submitting it again.

For long videos you can avoid holding an execution open:

- Turn off **Wait for Completion**, then use a **Wait** node and **Task > Get** (with **Wait for Completion** on).
- Or set **Callback URL** to `{{ $execution.resumeUrl }}` and follow with a **Wait** node set to resume on a
  webhook call. Your n8n instance must be reachable over public HTTPS. After it resumes, read the task with
  **Task > Get** rather than trusting the callback body (or verify the signature as described in
  [webhooks](https://popnow.ai/docs/webhooks)).

## Errors

Errors show the API's message, a hint on what to do, the HTTP status, the business `code` and the
`request_id` (include it when you contact support). Transient failures (network errors, `429`, `500`,
`502`-`504`, `50301`) are retried with backoff and `Retry-After`. Turn on **Continue On Fail** to get an
item with `error`, `description` and `taskId` instead of stopping the workflow.

| Code | Meaning | What to do |
| --- | --- | --- |
| `401` | The API key is missing or invalid | Check the credential |
| `40201` | Not enough API balance for the task's hold | Add funds at [popnow.ai/api/console/billing](https://popnow.ai/api/console/billing); website credits do not pay for API calls |
| `40202` | The key's USD spend cap was reached | Raise the cap in the API console |
| `40301` | The key may not call this model | Allow the model for the key |
| `40901` | The price changed between quote and create | Handled automatically once; run again otherwise |
| `429` | Too many requests | Run fewer items in parallel; see [limits](https://popnow.ai/docs/limits) |
| `state: failed` | The model could not finish or declined the content | Nothing was charged; read `errorCode` |

Full list: [popnow.ai/docs/errors](https://popnow.ai/docs/errors).

## Alternative: HTTP Request workflow (no install)

If you cannot install community nodes (for example on n8n Cloud), import
[`examples/http-request-workflow.json`](examples/http-request-workflow.json). It uses only built-in nodes:
**Start > Create task > Wait 5 s > Check task > Finished?**, looping until the task is done, then
**File URL** outputs `state`, `fileUrl` and `error`.

1. In n8n open **Credentials > Add credential > Header Auth**: name `PopNow`, header name `Authorization`,
   value `Bearer sk-popnow-...`.
2. Copy the JSON file's contents, click an empty spot on the canvas and paste (or use
   **Workflow menu > Import from File**).
3. Select the `PopNow` credential in **Create task** and **Check task**, then run it. The example uses
   `alibaba/z-image-turbo/text-to-image` and costs about $0.01 from your API balance.

To change the model or the input, edit the JSON body of **Create task**. The
[n8n guide on popnow.ai](https://popnow.ai/docs/n8n) explains each node, webhooks instead of polling, and
common errors.

## FAQ

### How do I generate AI images in n8n?

Install this node, add a **PopNow API** credential, then use **Image > Generate** with a text-to-image model
such as `alibaba/z-image-turbo/text-to-image`. The image comes back as binary data you can pass to any
storage or messaging node.

### How do I turn an image into a video with n8n?

Use **Video > Generate** with an image-to-video model such as `kling/3.0/image-to-video` or
`minimax/h3/image-to-video`. Add a **Media Input** for `image_url` from the incoming item's binary field or
from a URL; binary files are uploaded for you.

### Is there an official PopNow community node for n8n?

Yes, this repository, published on npm as `n8n-nodes-popnow`. On self-hosted n8n, install it from
**Settings > Community Nodes** or with `npm install n8n-nodes-popnow` in `~/.n8n/nodes`.

### Can I use PopNow on n8n Cloud?

n8n Cloud only installs verified community nodes, so use the
[HTTP Request workflow](#alternative-http-request-workflow-no-install). It calls the same API with built-in
nodes.

### How much does a generation cost, and can I cap it?

Each model has a USD rate, and runs are paid from your prepaid PopNow API balance (separate from popnow.ai
website credits). Every item is quoted first and the node refuses to run anything above
**Max Credits per Item** (1 credit = $0.001, so the default of 2,000 is $2.00). Use **Model > Get Quote** to
price a request in USD without running it. Failed runs are not charged. See
[API pricing](https://popnow.ai/api/pricing) and the [billing guide](https://popnow.ai/docs/billing).

### Will a retried n8n node charge me twice?

No. The node sends a deterministic `Idempotency-Key` per execution, node, item and input, so a retry gets
the original task back.

### Can n8n run several generations at once?

Yes. Each incoming item becomes its own task. Keep an eye on the [rate limits](https://popnow.ai/docs/limits)
and use a spend cap on the key.

## Development

```bash
npm ci            # install scripts stay off (.npmrc)
npm run lint      # n8n community node rules (strict mode)
npm test          # builds, then runs the unit tests in test/ with a fake API
npm run dev       # starts n8n with this node and rebuilds on change
```

Tests never call the live API. `test/repo-guard.test.js` also checks that every tracked file is English.

## Links

- Website: [popnow.ai](https://popnow.ai) · API pricing: [popnow.ai/api/pricing](https://popnow.ai/api/pricing) ·
  Add funds: [popnow.ai/api/console/billing](https://popnow.ai/api/console/billing)
- Docs: [popnow.ai/docs](https://popnow.ai/docs) · n8n guide: [popnow.ai/docs/n8n](https://popnow.ai/docs/n8n) ·
  API reference: [popnow.ai/docs/openapi.yaml](https://popnow.ai/docs/openapi.yaml) · [llms.txt](https://popnow.ai/llms.txt)
- Developer MCP server (API key, USD): [popnow.ai/api/mcp](https://popnow.ai/api/mcp) ·
  Agent skills: [popnow.ai/api/skills](https://popnow.ai/api/skills)
- Other PopNow repositories:
  [popnow-api-mcp](https://github.com/popnow-ai/popnow-api-mcp) ·
  [popnow-skills](https://github.com/popnow-ai/popnow-skills) ·
  [popnow-python](https://github.com/popnow-ai/popnow-python) ·
  [popnow-js](https://github.com/popnow-ai/popnow-js) ·
  [popnow-api](https://github.com/popnow-ai/popnow-api) ·
  [popnow-blender](https://github.com/popnow-ai/popnow-blender) ·
  [popnow-comfyui](https://github.com/popnow-ai/popnow-comfyui) ·
  [popnow-cli](https://github.com/popnow-ai/popnow-cli) ·
  [popnow-go](https://github.com/popnow-ai/popnow-go) ·
  [popnow-php](https://github.com/popnow-ai/popnow-php)

## License

[MIT](LICENSE) © PopNow
