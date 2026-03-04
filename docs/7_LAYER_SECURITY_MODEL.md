# Parler 7-Layer Security Model

This document adapts the 7-layer security pipeline model to this repository (`Parler`), a Tauri desktop app with a Rust backend and React/Bun frontend.

## Layer 1: Dependency Risk
Goal: catch vulnerable packages and crates before release.

Tools:
- `bun audit` for JS/TS dependencies
- `cargo audit` for Rust dependencies

## Layer 2: Secrets Management
Goal: prevent committed credentials, keys, and tokens.

Tools:
- `gitleaks` in CI
- existing local pre-commit secret scan hooks

Repo focus:
- `.env`-style files
- Tauri config and update key material
- accidental API keys in logs/settings snapshots

## Layer 3: Static Analysis (SAST)
Goal: detect code-level security mistakes.

Tools:
- Rust: `cargo clippy -- -D warnings`
- Frontend: `bun run lint`
- Optional: RepoSec scan when installed locally/CI

Repo focus:
- path handling in history/audio file operations
- command boundaries between frontend and Tauri commands
- logging of sensitive settings

## Layer 4: Human/AI-Assisted Review
Goal: add reasoning-based review for security-sensitive changes.

Recommended policy:
- require explicit security review for changes touching:
  - `src-tauri/src/settings.rs`
  - `src-tauri/src/commands/*`
  - `src-tauri/tauri.conf.json`
  - auth/update/network-related code

## Layer 5: Runtime/DAST Checks
Goal: validate behavior under runtime conditions.

For desktop apps, this is mostly integration validation:
- run Playwright smoke tests where applicable
- verify IPC command behavior for invalid input
- verify updater and asset protocol restrictions

## Layer 6: Supply Chain Integrity
Goal: ensure deterministic and safe builds.

Controls:
- prefer lockfile-enforced installs in CI (`bun install --frozen-lockfile`)
- fail if lockfiles are modified unexpectedly by CI checks
- avoid unpinned mutable install behaviors in scripts/workflows

## Layer 7: Observability & Incident Readiness
Goal: detect and respond quickly when security issues occur.

Controls:
- security workflow artifacts retained in CI
- release note template includes security impact section
- incident checklist for key exposure or unsafe logging regressions

## Recommended Maturity Path
1. Baseline: run Layers 1, 2, 3 on each PR.
2. Harden: add Layer 6 lockfile enforcement and branch protections.
3. Operationalize: formalize Layers 4, 5, 7 with documented owner/on-call flow.
