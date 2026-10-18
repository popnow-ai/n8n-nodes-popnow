# Security policy

## Reporting a vulnerability

Please do not open a public issue for security problems.

- Open a [private security advisory](https://github.com/popnow-ai/n8n-nodes-popnow/security/advisories/new) on GitHub, or
- email **support@popnow.ai** with "Security" in the subject.

Include a description, steps to reproduce and the package version. We aim to acknowledge reports within a
few business days.

## Keeping your API key safe

- Store the key only in the n8n **PopNow API** credential; n8n encrypts credentials at rest. Do not paste it
  into node parameters, expressions or workflow JSON that you share.
- Give n8n its own key with a spend cap, and revoke it in the [API console](https://popnow.ai/api/console/keys)
  if it leaks.
- Result links are signed and expire after about 20 minutes. The node downloads them without your API key.
- If you receive task callbacks, verify the `X-Webhook-Signature` header as described in
  [popnow.ai/docs/webhooks](https://popnow.ai/docs/webhooks) before trusting the body.
