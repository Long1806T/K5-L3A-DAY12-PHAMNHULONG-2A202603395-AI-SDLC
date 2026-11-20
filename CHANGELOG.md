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

## phase-3 (2026-11-20): Ticket-03 "Đèn cạn dầu" + Test Contract v1.2
Quyết định thiết kế: [ADR 0001](docs/adr/0001-lantern-fuel-and-dawn-win.md).

**Thay đổi phá vỡ tương thích (breaking changes):**
- `game_over.reason` không còn `all_lit`. Thắp hết đèn **không** kết thúc Đêm. Thắng chỉ xét ở bình minh với `dawn_survived` (≥ ceil(0,6 × tổng) đèn đang sáng).
- Thời lượng Đêm 300/330/360 s → **240/270/300 s**.
- Đèn đã sáng **nhận thêm đom đóm** (châm dầu, sự kiện `refuel`). Đèn hết dầu thì tắt (`lantern_out`), thắp lại chỉ cần 5 đom đóm.
- Vùng an toàn chỉ còn ở đèn có fuel ≥ 30. Bóng Mực có trạng thái mới `drain`.
- Công thức điểm thay toàn bộ: +5/đom đóm nạp (trước +10), thắp lần đầu +100, thắp lại +40, Tỏa Sáng +5 (+15 nếu Bóng Mực đang drain), bình minh +50 + floor(fuel) mỗi đèn sáng + 50 mỗi lửa. **Bỏ** thưởng thời gian.
- Snapshot: đèn thêm `fuel`, `ever_lit`, `relit_count`; `player` thêm `capacity`. `lantern_lit` thêm `relight`. Sự kiện mới `refuel`, `lantern_out`, `fuel_drain`.
- Sức chứa không còn cố định 10: 10 + 2 × số lần thắp thành công, tối đa 20.

**Mới:** thanh dầu trên đèn, nhấp nháy 1 Hz khi dưới 30, nhắc "E — Châm dầu"/"Thắp lại"; chế độ "Bảng màu dễ phân biệt" (được lưu).

## phase-4 · v1.0.0 (2026-11-20): Ticket-04 "Bình minh: phát hành v1.0.0" + Test Contract v1.3
Không đổi luật chơi. Output headless của mọi scenario cũ giữ nguyên.

**Mới:**
- `game.contract.json` v1.3 có thêm `bench_cmd` (`node tools/bench.js`) và `soak_cmd` (`node tools/soak.js`).
- **Benchmark**: mở cảnh chuẩn trong cửa sổ Chrome/Edge 1280×720, tắt vsync. Cảnh có 200 Bóng Mực, 100 đom đóm, L1–L3 sáng; camera bay vòng r = 30 m. Đo 30 s sau 3 s khởi động rồi ghi `bench.json`.
- **Soak**: 10 Đêm liên tiếp trong một tiến trình (Đêm 1 → 2 → 3, seed 7 + i), input ngẫu nhiên theo seed, ghi RSS đầu/cuối vào `soak.json`.
- **Bảng xếp hạng cục bộ**:
  - nhập tên ở màn Bình Minh và sau khi thua; tên 3–12 ký tự, nhận cả tiếng Việt có dấu;
  - giữ top 10; bằng điểm thì ai đạt trước đứng trên;
  - lưu ở `data/leaderboard.json` qua `tools/serve.js`;
  - xem từ menu;
  - xuất bằng `node tools/serve.js --export-leaderboard out.json`.
- **Dễ tiếp cận**:
  - đổi phím cho mọi hành động, có phát hiện trùng phím, đổi chỗ hai phím và nút "Khôi phục mặc định";
  - phụ đề và chỉ báo hình ảnh: mũi tên ở mép màn hình chỉ Bóng Mực mới xuất hiện, gió sắp thổi, 10 s cuối, đèn dưới 30 dầu;
  - giảm chuyển động;
  - chữ lớn ×1,25; mọi chữ ≥ 18 px.
- **Phát hành**: `node tools/release.js` (test → bench và soak trên máy phát hành → tag `phase-1`…`phase-4` → zip → GitHub Release `v1.0.0`). Thêm video demo, retro, `npm test` chạy được cả trên Windows.

**Sửa:**
- Lời dẫn Đêm 3 còn nói luật cũ "thắp đủ bảy ngọn đèn"; nay là "giữ ít nhất năm ngọn đèn sáng tới bình minh".
- Các chữ nhỏ hơn 18 px trên HUD và trong menu đã được nâng lên.
