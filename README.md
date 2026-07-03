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

Uses **npm Trusted Publishing** (OIDC) — no long-lived `NPM_TOKEN`, no 2FA token dance.

### One-time setup on npmjs.com

Trusted Publishing cannot create a brand-new package name. Do this **before** the first CI publish:

1. On [npmjs.com](https://www.npmjs.com), open your **queue-doctor** org → **Add package** / create package named exactly `queue-doctor` (unscoped).
2. Open that package → **Settings** → **Trusted Publisher** → **GitHub Actions**.
3. Fill in exactly:
   - **Organization or user:** `brognilucas`
   - **Repository:** `queue-doctor`
   - **Workflow filename:** `publish.yml`
4. Save.

If you only created the **org** and not the **package**, CI fails with `404` on `PUT …/queue-doctor`.

Docs: [Trusted publishers](https://docs.npmjs.com/trusted-publishers/).

### Each release

1. Bump `version` in `packages/core/package.json`.
2. Commit, tag, and create a GitHub Release (e.g. `v0.1.0`), **or** run **Actions → Publish to npm**.

The workflow authenticates with a short-lived OIDC token and publishes with provenance automatically.

Manual publish (local, still needs your npm login):

```bash
pnpm --filter queue-doctor publish --access public
```

After publish, anyone can run `npx queue-doctor`.

## Privacy

- **CLI / library:** runs on your machine; nothing is uploaded.
- **Web UI:** analysis runs in the browser for the MVP.
