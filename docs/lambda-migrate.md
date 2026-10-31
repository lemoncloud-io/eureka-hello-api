# Dev migration and code deployment (eureka-hello-api / dev)

The default profile's dev stack **`eureka-hello-api-dev`** was moved from Serverless to the deploy service on 2026-11-01.
`npm run lambda:migrate` (`lemon-lambda-migrate`) runs that move one reviewed phase at a time. `npm run lambda:deploy:dev` (`lemon-lambda-deploy-dev`) then updates the code of the two migrated dev functions from a verified pack.

The contract is documented once, in the lemon-core repository (`v5` branch; the npm package does not ship `docs/`):

-   [`docs/v5/B19-bin-deploy.md`](https://github.com/lemoncloud-io/lemon-core/blob/v5/docs/v5/B19-bin-deploy.md) — config keys, phases, consent flags, checkout checks, receipts, exit codes.
-   [`docs/v5/B24-migration-targets.md`](https://github.com/lemoncloud-io/lemon-core/blob/v5/docs/v5/B24-migration-targets.md) — the reviewed target registry and state-file names.
-   [`docs/v5/B27-migrate-inspect.md`](https://github.com/lemoncloud-io/lemon-core/blob/v5/docs/v5/B27-migrate-inspect.md) — `inspect`, `reconcile` and `resolve` after a migration.

The lemon-hello-api `docs/lambda-migrate.md` is the longer worked example of the same tools. This page keeps only what is specific to this service.

## Scope

-   Only the default profile (`profile=none`) dev stage is migrated.
-   prod, and the `ssocio`, `muzly` and `epyt` stacks, are still Serverless stacks. They are not reviewed targets. They deploy with their `sls` scripts ([serverless.md](serverless.md)).
-   After this migration, do not run `npm run deploy` or `npm run remove` (default profile, dev) in that account. The dev functions belong to the deploy service.

## lemon-core version

-   lemon-core 5.0.18 does not list eureka-hello-api / dev / `eureka-hello-api-dev` as a reviewed target. lemon-core PR #266 adds it.
-   Until that release, `lambda:migrate` and `lambda:deploy:dev` stop with `TARGET_MISMATCH` (exit 2) for this service.
-   `lambda:deploy` in `code` mode does not use the target list. It is the dev code path now ([lambda-tools.md](lambda-tools.md#pack-and-offline-deploy-plan)).

## Prepare (for later runs)

The configs live only under `.artifacts/` (git-ignored). Never commit them.

```sh
mkdir -p .artifacts
# migration config: replace account, region, profile, endpoint and artifactBucket
cp migration.config.example.json .artifacts/migration.dev.json
# dev code-deploy config: the same installation values
cp deploy.dev.config.example.json .artifacts/deploy.dev.json
```

-   Every value in the two example files is a placeholder. A placeholder config plans offline but cannot execute.
-   `migrationRepo` resolves relative to the config file. `../../eureka-deploy-api` fits a sibling checkout and a config in `.artifacts/`. The checkout must be `lemoncloud-io/eureka-deploy-api` at the pinned revision `66d1e91a60a240765d44dedfdab73a92af6abd51` with a clean tracked tree.
-   `project`, `stage`, `stack` and `migrationRevision` are fixed by the reviewed target. Another value stops with `TARGET_MISMATCH` or `REVISION_MISMATCH` (exit 2).
-   The wrapper reads neither `env/` nor `serverless.yml`. It reads the live stack.
-   Never use `bootstrap` mode for this service. Use the migration, then `code` mode only.

## Dev migration result (2026-11-01)

The owner authorized the dev migration directly on dev, without a rehearsal. It ran with the lemon-core wrapper of the PR #266 branch and the pinned migration checkout. The private config had `"runtime": "nodejs24.x"`: the live functions were on `nodejs22.x`, and a pre-check loaded the old code on Node 24.

| Phase                   | Result                                      |
| ----------------------- | ------------------------------------------- |
| `plan`                  | ready, 0 warnings, 8 resources kept         |
| `retain`                | ready, the 8 kept resources set to `Retain` |
| `remove`                | ready, stack removed                        |
| `tag`                   | ready                                       |
| `apply`                 | ready, old code on Node 24                  |
| `verify`                | completed, every compared row the same      |
| `inspect` + `reconcile` | `verified-no-op`                            |

-   **API downtime** was at most about 3 min (2 min 51 s, from the start of `remove` to the end of `apply`). Before and after, `GET /`, `/hello` and `/hello/0` returned 200 and an unknown path 403.
-   **Expected difference:** runtime `nodejs22.x` → `nodejs24.x`, excluded from the comparison by design. No log retention difference: `serverless.yml` sets 14 days in the template.
-   **After:** both functions on Node 24, no error lines in the function logs for 15 minutes. The functions still run the old code until the next code deploy.
-   **Not proven:** data equality, event delivery during the downtime.

## Deploy a new pack to dev

```sh
# verified ZIP into a new directory (Docker, no AWS)
npm run lambda:pack -- --output .artifacts/lambda/release-candidate
# now (lemon-core 5.0.18): offline plan of a code-mode deploy
npm run lambda:deploy -- --config .artifacts/deploy.code.json --artifact .artifacts/lambda/release-candidate
# after the lemon-core release with #266: offline plan of the guarded dev deploy
npm run lambda:deploy:dev -- --config .artifacts/deploy.dev.json --artifact .artifacts/lambda/release-candidate
```

-   After reviewing that exact artifact and config, a human adds `--apply` to the same command.
-   `code` mode changes code only: no environment, runtime, handler, memory, timeout, IAM, route or wiring change.
