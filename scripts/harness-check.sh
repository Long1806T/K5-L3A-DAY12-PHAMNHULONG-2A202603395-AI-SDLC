#!/bin/sh
# Demonstrates that the harness blocks a red test suite (agent Stop hook + git pre-commit).
# Writes docs/proof/phase-N/harness-check.txt. Paths are printed relative to the repo.
#   sh scripts/harness-check.sh [N]
cd "$(dirname "$0")/.." || exit 1
phase="${1:-1}"
out="docs/proof/phase-$phase/harness-check.txt"
root="$(pwd)"
red=tests/zz-red.test.js
{
  echo "# Harness check (real output, $(date -u +%FT%TZ))"
  echo
  echo "\$ cat $red   # a deliberately failing test, removed afterwards"
  printf "import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('deliberately red', () => assert.equal(1, 2));\n" > "$red"
  cat "$red"
  echo
  echo '$ sh scripts/verify.sh --hook   # what the agent Stop hook runs'
  sh scripts/verify.sh --hook 2>&1
  echo "exit code: $?  (2 = Stop hook blocks the agent from finishing)"
  echo
  echo '$ git commit -m "try to commit while red"   # .githooks/pre-commit'
  git add "$red"
  git -c core.hooksPath=.githooks commit -q -m "try to commit while red" >"${TMPDIR:-/tmp}/ddl-hc.log" 2>&1
  code=$?
  head -n 4 "${TMPDIR:-/tmp}/ddl-hc.log"
  echo "commit exit code: $code"
  git reset -q HEAD "$red"
  rm -f "$red"
  echo
  echo '$ git log -1 --format=%s   # the red commit did not happen'
  git log -1 --format=%s
  echo
  echo '$ sh scripts/verify.sh --hook   # after removing the red test'
  sh scripts/verify.sh --hook 2>&1
  echo "exit code: $?"
} 2>&1 | sed "s#$root#.#g; s#${TMPDIR:-/tmp}/#\$TMPDIR/#g" > "$out"
cat "$out"
