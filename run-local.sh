#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "Docker Compose is required. Install Docker Desktop or Docker Engine with Compose."
  exit 1
fi

"${COMPOSE[@]}" up -d postgres
"${COMPOSE[@]}" ps

echo
echo "PostgreSQL is starting locally at localhost:5431."
echo "Run the backend and client separately using the commands in README.md."
echo "Use ./logs-local.sh to follow database startup, or ./stop-local.sh to stop it."
