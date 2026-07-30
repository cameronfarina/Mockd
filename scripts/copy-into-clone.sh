#!/usr/bin/env bash
set -euo pipefail
SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_DIR="${1:?Usage: scripts/copy-into-clone.sh /path/to/Mockd}"
rsync -av --exclude '.git' "$SOURCE_DIR/" "$TARGET_DIR/"
