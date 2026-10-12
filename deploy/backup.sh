#!/usr/bin/env bash
set -euo pipefail
dir=/var/backups/opencash-monad
mkdir -p "$dir"
tar -czf "$dir/data-$(date +%F).tar.gz" -C /opt/opencash-monad/backend data
ls -1t "$dir"/data-*.tar.gz | tail -n +15 | xargs -r rm --
