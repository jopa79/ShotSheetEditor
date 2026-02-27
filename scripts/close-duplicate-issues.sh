#!/usr/bin/env bash
# Close duplicate issues in jopa79/ShotSheetEditor
#
# Prerequisites:
#   - gh CLI installed and authenticated (gh auth login)
#   - Write access to the repository
#
# Usage:
#   ./scripts/close-duplicate-issues.sh
#
# This script will:
#   1. Post a comment on each duplicate issue referencing the master issue
#   2. Close the duplicate issue with reason "not_planned"

set -euo pipefail

REPO="jopa79/ShotSheetEditor"

# Define duplicate mappings: "duplicate_issue:master_issue"
DUPLICATES=(
  "1:16"    # eval() Code Injection
  "2:18"    # Shell Injection via execSync
  "19:3"    # scene.startTime existiert nicht
  "20:4"    # getThumb IPC-Signatur falsch
  "21:5"    # gridSize String statt Number
  "44:5"    # gridSize String statt Number
  "49:6"    # Nicht-atomares Save
  "7:17"    # Path Traversal in getThumb
  "27:13"   # XSS via innerHTML / fehlende CSP
  "51:13"   # XSS via innerHTML / fehlende CSP
  "25:43"   # Race Condition bei Scene Detection
  "45:26"   # Promise Anti-Pattern in IPC Handlers
)

echo "Closing ${#DUPLICATES[@]} duplicate issues in $REPO..."
echo ""

for entry in "${DUPLICATES[@]}"; do
  dup="${entry%%:*}"
  master="${entry##*:}"

  echo "Closing #$dup as duplicate of #$master..."

  # Post comment
  gh issue comment "$dup" \
    --repo "$REPO" \
    --body "Closing as duplicate of #$master — see that issue for the comprehensive description and proposed fix."

  # Close issue
  gh issue close "$dup" \
    --repo "$REPO" \
    --reason "not planned" \
    --comment ""

  echo "  Done."
done

echo ""
echo "All duplicates closed. Verifying..."
open_count=$(gh issue list --repo "$REPO" --state open --json number --jq 'length')
echo "Open issues remaining: $open_count (expected: 35)"
