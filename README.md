# QueueDoctor

CLI and library for a **serverless production readiness report** — failure handling, retries, observability, and cost/risk.

No AWS credentials required. Runs on your machine.

## Use it

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

## Develop

```bash
pnpm install
pnpm build
pnpm test
pnpm queue-doctor packages/core/tests/fixtures/serverless-bad.yml
```

```
packages/core   publishable package `queue-doctor` (analyze + CLI)
```

## Publish

CI uses **npm Trusted Publishing** (OIDC). The package already exists on npm: https://www.npmjs.com/package/queue-doctor

### Later releases

1. Bump `version` in `packages/core/package.json`
2. Commit, tag, and create a GitHub Release, **or** **Actions → Publish to npm** on `main`

Trusted Publisher (already configured):

- **Organization or user:** `brognilucas`
- **Repository:** `queue-doctor`
- **Workflow filename:** `publish.yml`

### First publish (historical)

Bootstrap was a one-time local `npm publish` from `packages/core` with an automation token, because Trusted Publishing cannot create a new package name. See npm [Trusted publishers](https://docs.npmjs.com/trusted-publishers/).

## Privacy

Analysis runs on your machine. Nothing is uploaded.
