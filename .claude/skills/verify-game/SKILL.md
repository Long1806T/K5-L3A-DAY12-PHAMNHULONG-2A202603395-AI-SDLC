---
name: verify-game
description: Run the game's checks and save evidence for a phase (tests, headless scenarios on all nights, determinism, screenshots, sounds, FPS). Use before tagging a phase or after changing src/core, the contract or the web UI.
---

# Verify Đảo Đèn Lồng and save evidence

1. `npm test`: must be green. If red, fix the code (never weaken a test to make it pass; if a requirement changed, update the test, add a `P<n>:` comment with the reason, and list it in `docs/notes/phase-N.md`).
2. Every new rule/feature gets a scenario in `scenarios/phaseN/` (scenario + inputs, contract format) and a test in `tests/features.test.js` that runs it through `headless_cmd` (`cli()` in `tests/helpers.js`). Use the night the feature lives on (`--night 2/3`).
3. Add the new scenarios to `PHASE_RUNS` in `tools/proof.js`, then `npm run proof -- --phase N`. It regenerates `docs/proof/phase-N/proof.md`, `runs/`, `test-report.txt` (all nights: determinism, full-night speed, autopilot) and, from Phase 3, runs the previous phase's `tests/` against the new code so every broken old test is listed. Never edit those files by hand.
4. `node tools/capture.mjs --phase N` (writes `docs/proof/phase-N/screens`) plays the browser build in headless Chrome (SwiftShader) and writes screenshots + `capture-report.json` (checks: arrow, pause, settings persistence, wind, sounds fired, FPS + CPU ms). Any console error fails the run.
5. `sh scripts/harness-check.sh N` proves the hooks still block a red suite.
6. Update the hand-written traceability table `docs/proof/phase-N/README.md`: requirement → how verified → evidence → result. Write "chưa đạt" honestly (e.g. FPS measured only in software rendering).
7. Commit evidence last, in its own commit, right after the code it describes.
8. Phase 4 / release only:
   - `node tools/soak.js --seed 7 --nights 10 --out soak.json` and `node tools/bench.js --seed 42 --duration 30 --out bench.json` (the contract's `soak_cmd` / `bench_cmd`). With no GPU, set `BENCH_BROWSER_FLAGS="--use-angle=swiftshader --enable-unsafe-swiftshader"` and say in the docs that the FPS is not meaningful.
   - `node tools/demo.mjs` renders `docs/demo/demo.mp4` (< 5 min) from the real game and real command output.
   - `node tools/release.js` is run by the user on their own machine: it re-measures bench/soak, tags `phase-1`…`phase-4` without moving existing tags, zips the build and creates Release `v1.0.0`.
