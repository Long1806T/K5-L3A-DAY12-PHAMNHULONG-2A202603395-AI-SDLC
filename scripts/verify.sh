#!/bin/sh
# One-command verification for humans, git hooks and agent hooks.
#   sh scripts/verify.sh          run tests + a headless smoke run
#   sh scripts/verify.sh --hook   same, but exit 2 (blocking) when red, for agent Stop hooks
cd "$(dirname "$0")/.." || exit 1
tmp="${TMPDIR:-/tmp}"
if ! npm test --silent >"$tmp/ddl-verify-tests.log" 2>&1; then
  grep -E "^not ok|^# (tests|pass|fail)" "$tmp/ddl-verify-tests.log" >&2
  echo "verify: tests are RED. Fix them before finishing (log: $tmp/ddl-verify-tests.log)." >&2
  [ "$1" = "--hook" ] && exit 2
  exit 1
fi
grep -E "^# (tests|pass|fail)" "$tmp/ddl-verify-tests.log"
if ! node src/headless.js --seed 1 --night 1 --ticks 600 --out "$tmp/ddl-verify.jsonl"; then
  echo "verify: headless smoke run failed." >&2
  [ "$1" = "--hook" ] && exit 2
  exit 1
fi
echo "headless smoke: $(tail -n 1 "$tmp/ddl-verify.jsonl")"
