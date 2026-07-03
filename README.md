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

CI uses **npm Trusted Publishing** (OIDC) — no long-lived token. But Trusted Publishing **cannot create** a package that does not exist yet, and npm **orgs** often block “create package” until a team/package already exists. Skip the org UI for the first publish.

### First publish (once, on your machine)

Use your **personal** npm account (not the org). Interactive 2FA/OTP is fine here.

```bash
pnpm install
pnpm --filter queue-doctor build
cd packages/core
npm login          # personal user, complete OTP if asked
npm publish --access public
```

That creates unscoped `queue-doctor` under your user. Confirm: https://www.npmjs.com/package/queue-doctor

### Hook up CI (after the package exists)

1. Package page → **Settings** → **Trusted Publisher** → **GitHub Actions**
2. Exactly:
   - **Organization or user:** `brognilucas`
   - **Repository:** `queue-doctor`
   - **Workflow filename:** `publish.yml`
3. Save

You can transfer the package to the **queue-doctor** org later from package settings if you want; it is optional for `npx queue-doctor`.

### Later releases

1. Bump `version` in `packages/core/package.json`
2. Commit, tag, and create a GitHub Release, **or** **Actions → Publish to npm** on `main`

Docs: [Trusted publishers](https://docs.npmjs.com/trusted-publishers/).

## Privacy

- **CLI / library:** runs on your machine; nothing is uploaded.
- **Web UI:** analysis runs in the browser for the MVP.
