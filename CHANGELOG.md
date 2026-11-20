# CHANGELOG

## phase-1 (2026-11-20): PRD-0 + Test Contract v1.0
- Đêm 1 – Đảo Bến chơi được từ đầu tới thắng/thua: đi lại, nhảy, camera 3D, đom đóm, nạp và thắp 5 Đèn Lồng Lớn, Bóng Mực đuổi, tỏa sáng, vùng an toàn quanh đèn, HUD, chơi lại.
- Chế độ headless `node src/headless.js` theo Test Contract v1.0, `game.contract.json` là nguồn tuning duy nhất.
- 48 test (luật, CLI, mã thoát, tất định, autopilot thắng trọn đêm), bằng chứng tự sinh, ảnh chụp từ Chrome headless.
- Harness: AGENTS.md, Stop hook + pre-commit chặn khi test đỏ, skill verify-game, CI.
