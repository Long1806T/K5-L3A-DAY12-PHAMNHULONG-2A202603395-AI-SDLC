# CHANGELOG

## phase-1 (2026-11-20): PRD-0 + Test Contract v1.0
- Đêm 1 – Đảo Bến chơi được từ đầu tới thắng/thua: đi lại, nhảy, camera 3D, đom đóm, nạp và thắp 5 Đèn Lồng Lớn, Bóng Mực đuổi, tỏa sáng, vùng an toàn quanh đèn, HUD, chơi lại.
- Chế độ headless `node src/headless.js` theo Test Contract v1.0, `game.contract.json` là nguồn tuning duy nhất.
- 48 test (luật, CLI, mã thoát, tất định, autopilot thắng trọn đêm), bằng chứng tự sinh, ảnh chụp từ Chrome headless.
- Harness: AGENTS.md, Stop hook + pre-commit chặn khi test đỏ, skill verify-game, CI.

## phase-2 (2026-11-20): Ticket-02 "Ba hòn đảo" + Test Contract v1.1
**Thay đổi phá vỡ tương thích (so với phase-1):**
- Mọi số tuning thay bằng số chuẩn (sức chứa 10, đèn 10 đom đóm, Tỏa Sáng 3 đom đóm / 5 m 3D / 120 tick choáng, Bóng Mực 4 m/s, đảo r = 40 m, rơi khỏi đảo bị phạt…).
- Vùng an toàn chỉ còn ở **đèn đã sáng** (6 m) và chỉ chặn Bóng Mực; điểm +10 tính khi **nạp**, không khi nhặt.
- Bóng Mực không còn có sẵn lúc đầu: 2 con ở tick 300, rồi theo lịch từng Đêm; trạng thái spawning/wander/chase/recoil/stunned.
- Snapshot/scenario/input theo v1.1 (`night`, `wind`, `player.vel/grounded/invuln/…`, `motes[].kind/ttl_s`, `drifters`, `charms`, input `dash`/`pause`, sự kiện `night_start` ở tick 0).

**Mới:** 3 Đêm (Đảo Bến, Đảo Cau có cầu tre + bục nhảy, Đảo Chuông có 3 tầng, dốc, tháp chuông, gió mạnh), Lướt, rơi khỏi đảo + hồi sinh, Gió Lạc, Bùa Gió, tạm dừng; chuỗi 3 Đêm với menu, lời Ông Đăng, kết quả, Bình Minh; menu tạm dừng; cài đặt (âm lượng, độ nhạy chuột, lưu lại); nhạc nền + 10 hiệu ứng âm thanh tổng hợp; HUD đầy đủ theo bố cục ticket; bảng màu chuẩn.
