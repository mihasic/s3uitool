# CLAUDE.md

S3/SQS browser served as a single container: `api/` (Hono on Bun) serves the built
`app/` (React + Vite) as static files. `e2e/` is Playwright. One Bun workspace, one
`biome.json`, a root `tsconfig.json` referencing `api/` and `app/`.

## Commands

`bun run` covers the rest; these are the ones with prerequisites:

```bash
bun run dev:local   # dev stack pointed at the local emulators
bun run seed        # seed test data (needs the emulators up)
bun run test:api    # needs: docker compose up -d rustfs elasticmq
bun run check       # Biome, whole repo
bun run typecheck   # tsc -b, both workspaces
```

Dependency bumps and the rest of the routine upkeep: the `/chore` skill.

CI runs E2E against the built container, not Vite:

```bash
docker compose up -d --build && bun run seed
APP_PORT=8000 bun run test:e2e
```

The API targets no client but `app/`; the two change together.

## Frontend rules

TanStack Query for server state, `sonner` toasts via `reportError`, `ApiError` in `lib/api.ts`.

## Environment

Full table: README "Configuration". Non-obvious: `MAX_UPLOAD_MB` also bounds per-upload
memory, since Bun buffers multipart bodies.

## Profiles

`api/src/profiles.ts` is the single place that resolves AWS targets. The global `AWS_*`
vars always yield the default profile (`DEFAULT_PROFILE_ID`, default `default`);
`PROFILE_<id>_*` groups add more; `~/.aws` is read unless `ENABLE_PROFILE_DISCOVERY=0`
(narrow it with `AWS_CONFIG_PROFILES`). Ini profiles resolve credentials through
`fromIni({ profile })` — never `fromNodeProviderChain({ profile })`, which prefers ambient
env keys and would sign a real account with the emulator's credentials.

Clients are cached per profile in `api/src/aws.ts` and keyed on `Profile.fingerprint`;
nothing else may construct them (`.biome/plugins/aws-clients.grit`). Routes are mounted
both at `/api/:profile/{s3,sqs}` and at the legacy `/api/{s3,sqs}`, and handlers read
`c.get("s3")` / `c.get("sqs")` from the Hono context (`api/src/context.ts`). Frontend
routes are `/$profile/s3/$bucket`; pre-profile URLs redirect. Profile ids are slugified and
must not collide with an API segment or a `STATIC_DIR` entry.

## Tests

`api/tests/setup.ts` is a `bun test` preload: it points the SDK at the emulators and
creates `test-bucket-1/2` and `test-queue-1/2`. Playwright is Chromium-only and relies on
seeded data.
