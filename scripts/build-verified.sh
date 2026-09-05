#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "${script_dir}/build.mjs"
bash "${script_dir}/validate-artifact.sh"
