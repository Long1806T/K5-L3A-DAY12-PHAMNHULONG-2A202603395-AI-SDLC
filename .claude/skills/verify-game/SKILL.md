---
name: verify-game
description: Run the game's checks and save evidence for a phase (tests, headless scenarios, determinism, screenshots). Use before tagging a phase or after changing src/core or the contract.
---

# Verify Đảo Đèn Lồng and save evidence

1. `npm test`: must be green. If red, fix the code (never weaken a test to make it pass; if a requirement changed, update the test and write the reason in `docs/notes/phase-N.md`).
2. If the phase added rules, add a scenario in `scenarios/phaseN/` and a test that runs it through the CLI (`tests/helpers.js` → `cli()`).
3. `npm run proof -- --phase N` regenerates `docs/proof/phase-N/proof.md` + `runs/` + `test-report.txt` from real runs. Do not edit those files by hand.
4. `node tools/capture.mjs --out docs/proof/phase-N/screens` plays the browser build in headless Chrome and saves screenshots + `capture-report.json` (needs Playwright + Chrome; dev only).
5. Update the hand-written traceability table `docs/proof/phase-N/README.md`: requirement → how verified → evidence → result. Write "chưa đạt" honestly when something fails.
6. Commit evidence in the same commit range that the `phase-N` tag points to.
