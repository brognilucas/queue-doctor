# queue-doctor

Serverless production readiness report — focused on failure handling, retries, observability, and cost/risk.

No AWS credentials. Deterministic rules over your config.

## CLI

```bash
npx queue-doctor serverless.yml
npx queue-doctor template.yaml --markdown > report.md
npx queue-doctor ./infra/sam.yaml --json
```

Exit code `1` when any **fail**-severity finding is present (useful in CI).

## Library

```ts
import { analyze } from "queue-doctor";

const outcome = analyze(configSource);
if (outcome.ok) {
  console.log(outcome.result.score, outcome.result.findings);
  console.log(outcome.markdown);
}
```

## Supported inputs

- Serverless Framework `serverless.yml`
- SAM / CloudFormation YAML
- SAM / CloudFormation JSON
