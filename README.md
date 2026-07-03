# QueueDoctor

Paste or pipe a serverless config. Get a **production readiness report** focused on failure handling, retries, observability, and cost/risk.

No AWS credentials required.

## Use it (no domain needed)

```bash
npx queue-doctor serverless.yml
npx queue-doctor template.yaml --markdown > report.md
npx queue-doctor ./infra/sam.yaml --json
```

Exit code `1` when any **fail** finding is present — works in CI.

### Library

```ts
import { analyze } from "queue-doctor";

const outcome = analyze(configSource);
if (outcome.ok) {
  console.log(outcome.result.score, outcome.markdown);
}
```

## Monorepo

```
packages/core   publishable package `queue-doctor` (analyze + CLI)
apps/web        optional UI that consumes the same package
```

## Develop

```bash
pnpm install
pnpm build
pnpm test

# CLI (local)
pnpm queue-doctor packages/core/tests/fixtures/serverless-bad.yml

# UI
pnpm dev
```

## Publish

GitHub Actions publishes `queue-doctor` to npm when you **create a GitHub Release**, or via **Actions → Publish to npm → Run workflow**.

1. Add repo secret **`NPM_TOKEN`** (npm access token with publish permission).
2. Bump `version` in `packages/core/package.json`.
3. Commit, tag, and create a release (e.g. `v0.1.0`), **or** run the workflow manually.

The workflow runs tests, builds, and `pnpm publish --access public --provenance`.

Manual publish (local):

```bash
pnpm --filter queue-doctor publish --access public
```

After publish, anyone can run `npx queue-doctor`.

## Privacy

- **CLI / library:** runs on your machine; nothing is uploaded.
- **Web UI:** analysis runs in the browser for the MVP.
