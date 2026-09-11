#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

if docker compose version >/dev/null 2>&1; then
  docker compose down
else
  docker-compose down
fi
