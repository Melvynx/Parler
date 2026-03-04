.PHONY: help security security-l1 security-l2 security-l3 security-l4 security-l5 security-l6 security-l7

help:
	@echo "Security targets:"
	@echo "  make security      - Run L1 + L2 + L3 + L6"
	@echo "  make security-l1   - Dependency audits (bun + cargo)"
	@echo "  make security-l2   - Secrets scan (gitleaks)"
	@echo "  make security-l3   - Static analysis (lint + clippy)"
	@echo "  make security-l4   - Human/AI review reminder"
	@echo "  make security-l5   - Runtime/DAST reminder"
	@echo "  make security-l6   - Supply chain checks"
	@echo "  make security-l7   - Observability reminder"

security: security-l1 security-l2 security-l3 security-l6

security-l1:
	bun audit --production
	cd src-tauri && cargo audit

security-l2:
	@command -v gitleaks >/dev/null || (echo "gitleaks not installed" && exit 1)
	gitleaks detect --source . --no-git --redact

security-l3:
	bun run lint
	cd src-tauri && cargo clippy --all-targets --all-features -- -D warnings

security-l4:
	@echo "Perform manual security review for sensitive files before merge."

security-l5:
	@echo "Run runtime checks (Playwright/manual IPC checks) for behavior-sensitive changes."

security-l6:
	bun install --frozen-lockfile
	git diff --exit-code -- bun.lock src-tauri/Cargo.lock

security-l7:
	@echo "Capture and retain security scan evidence in PR description/release notes."
