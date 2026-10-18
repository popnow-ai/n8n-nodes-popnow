# Contributing

Thanks for helping improve the PopNow node for n8n.

1. Fork the repository and create a branch.
2. `npm ci` (install scripts are disabled by `.npmrc`), then make your change.
3. Run `npm run lint && npm test`. Tests run the compiled node against a fake API and never call the live
   service. `npm run dev` starts a local n8n with the node loaded.
4. Open a pull request that explains what changed and why.

Guidelines:

- Keep the package free of runtime dependencies and keep `npm run lint` passing in strict mode (the default
  `eslint.config.mjs`), so the package stays eligible for n8n verification.
- Do not add install-time lifecycle scripts (`prepare`, `postinstall`, ...). The `release` branch carries
  the built files instead.
- Follow the public API contract at [popnow.ai/docs/openapi.yaml](https://popnow.ai/docs/openapi.yaml). Do
  not add endpoints or fields that are not documented there.
- Keep everything in English; `test/repo-guard.test.js` enforces it.
- Add a test for every behaviour change and a line to `CHANGELOG.md`. Bump the version in `package.json`,
  `nodes/PopNow/shared/constants.ts` and the credential test User-Agent together (a test checks they match).

For questions about the API itself (accounts, billing, models), contact [PopNow support](https://popnow.ai/contact).
