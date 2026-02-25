#!/bin/bash
set -euo pipefail

BATCH_SIZE=${BATCH_SIZE:-10}
TOTAL=${TOTAL:-2879}
START_OFFSET=${START_OFFSET:-0}

OFFSET=$START_OFFSET

while [ "$OFFSET" -lt "$TOTAL" ]; do
  LIMIT=$BATCH_SIZE
  if [ $((OFFSET + LIMIT)) -gt "$TOTAL" ]; then
    LIMIT=$((TOTAL - OFFSET))
  fi

  echo "Running batch: offset=$OFFSET limit=$LIMIT"
  BATCH_SIZE=$BATCH_SIZE MIGRATION_STAGE=articles ARTICLE_OFFSET=$OFFSET ARTICLE_LIMIT=$LIMIT npx tsx scripts/migrate-supabase-to-d1.ts

  OFFSET=$((OFFSET + LIMIT))
  echo "Completed offset=$OFFSET"
  sleep 1

done
