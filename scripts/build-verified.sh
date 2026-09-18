#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -n "${MIZAN_DATABASE_URL:-}" ]]; then
  npm run db:migrate
  node "${script_dir}/seed-regulatory-baseline.mjs"
  node "${script_dir}/seed-cma-baseline.mjs"
  node "${script_dir}/seed-kyc-platform-baseline.mjs"
  npm run db:check
fi

node "${script_dir}/build.mjs"
bash "${script_dir}/validate-artifact.sh"
