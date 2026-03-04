# Security Pipeline Quick Reference (Parler)

## Purpose
Run a repeatable security pipeline for this repo using Bun + Rust + Tauri tooling.

## Layers and Commands

L1 Dependency Risk:
- `bun audit`
- `cd src-tauri && cargo audit`

L2 Secrets:
- `gitleaks detect --source . --no-git --redact`

L3 SAST:
- `bun run lint`
- `cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings`

L4 Human/AI Review:
- required on security-sensitive file changes (settings/commands/tauri config)

L5 Runtime Checks:
- `bun run test:playwright` (when UI/runtime changes are relevant)

L6 Supply Chain Integrity:
- enforce `bun install --frozen-lockfile` in CI
- enforce stable lockfiles (`bun.lock`, `src-tauri/Cargo.lock`)

L7 Observability:
- keep CI artifacts and security scan outputs
- track security fixes in changelog/release notes

## Local Entrypoints
- `make security` runs L1+L2+L3+L6 checks
- `make help` lists all layer targets

## CI Entrypoint
- `.github/workflows/security.yml`
