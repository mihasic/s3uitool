---
name: chore
description: Routine upkeep for s3uitool — bump packages (72h backoff), bun audit, bump GitHub Actions and base images, /code-review, /simplify, refresh README/CLAUDE.md, open a PR, release on request. Use for "regular chore", "bump deps/packages", "bump actions", "dependency update".
---

# Regular chore

One branch, one PR. Bun only — never `npm`/`npx`.

## 1. Branch

```bash
git switch main && git pull
git switch -c chore/deps-$(date +%F)
```

## 2. Packages (72h backoff)

`bunfig.toml` sets `minimumReleaseAge = 259200`, so every resolution — transitives included —
is ≥72h old. `bun outdated` marks age-held versions with `*`.

```bash
bun outdated --filter '*'
```

- Majors (`Latest` major > current): list them, **ask** before taking.
- Set each manifest to the `Update` / `Latest` version, keeping its spec style (`api/` and
  napi/Playwright pins exact, the rest carets).
- Re-resolve from scratch — `bun update` leaves locked transitives alone, which splits the
  AWS/Smithy tree into two copies:

  ```bash
  rm bun.lock && bun install
  grep -oE '"@smithy/core@[0-9][^"]*"' bun.lock | sort -u   # exactly one
  ```
- `oxc-transform-react` bump: confirm the React Compiler still fires after `bun run build`:
  `grep -l memo_cache_sentinel app/dist/assets/*.js` must list files.

## 3. Audit

```bash
bun audit
```

CI's `build` job runs it and `release.yml` re-runs CI, so any advisory blocks a release.
Transitive-only → root `overrides` in `package.json`. Every override must move the
resolution (verify in `bun.lock`, e.g. `monaco-editor` pins `dompurify` lower); delete dead ones.

## 4. Actions and images

```bash
grep -rhoE 'uses: [^./][^@]+@\S+' .github/workflows | sort -u | while read -r _ ref; do
  echo "$ref -> $(gh api repos/${ref%@*}/releases/latest --jq .tag_name)"; done
```

Keep moving major tags (`@vN`); change only on a new major. Full-version pin only when the
action publishes no major tag. Also check `Dockerfile` bases (`oven/bun:1`,
`gcr.io/distroless/cc-debian*`) — a new Debian release is a major: ask.

## 5. Verify

```bash
bun run check && bun run typecheck && bun run test:app && bun run --filter '*' build
docker compose up -d rustfs elasticmq && bun run test:api
```

Port 9000/9324 may be taken locally (SSH tunnels) — then skip `test:api` and say so. E2E runs in CI only.

If `Dockerfile` or the API build changed, build both arches and hit `/api/health` on each:

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t s3uitool:probe .
docker run -d --rm --platform linux/amd64 -p 18765:8000 s3uitool:probe   # then arm64
curl -s localhost:18765/api/health
```

## 6. Review

Base = previous chore commit on main (`git log --grep '^chore(deps)' -1 --format=%h main`).

1. `/code-review high <base>..HEAD`
2. `/simplify` on the same range

Apply confirmed findings as separate commits, re-run step 5.

## 7. Docs

Check `README.md` and `CLAUDE.md` against the code: `package.json` scripts, env vars
(`grep -rn 'process.env' api/src`) and their real defaults, `Dockerfile`, `docker-compose.yml`,
workflows, `scripts/`. Fix stale facts; cut duplication and prose the code already says.

## 8. PR

```bash
git commit -m "chore(deps): <headline bumps>"
gh pr create
```

Body: bumps table, held-back majors, audit, action/image changes, review fixes, doc changes.
**Stop. Don't merge unless asked** (then `gh pr merge <n> --squash --delete-branch`).

## 9. Release — only when asked

```bash
bun audit                                                         # on main: a fresh advisory would fail the run
git ls-remote --tags --refs origin | awk -F/ '{print $3}' | sort -V | tail -1
```

Patch bump by default; minor only if the user says so. Dispatch as a standalone command
(chained with `&&`/`;` it gets blocked):

```bash
gh workflow run release.yml --ref main -f version=X.Y.Z
```

A failed run publishes nothing (`build-and-push` needs `checks`) — fix and re-dispatch.

## Gotchas

- zsh: `status` is read-only; don't use it as a variable.
