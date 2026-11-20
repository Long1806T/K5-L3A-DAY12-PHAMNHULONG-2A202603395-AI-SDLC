# Phase 4 · Truy vết yêu cầu → bằng chứng

Mốc: tag `phase-4` + Release `v1.0.0`. Chạy lại bằng chứng:

- `npm test && npm run proof -- --phase 4`. Bench trên máy không có GPU cần `BENCH_BROWSER_FLAGS="--use-angle=swiftshader --enable-unsafe-swiftshader"`.
- Ảnh: `node tools/capture.mjs --phase 4`.
- Video: `node tools/demo.mjs`.

Tiêu chí P4-x và giả định: [phase-4.md](../../notes/phase-4.md). Số liệu trong [proof.md](proof.md) và [screens/capture-report.json](screens/capture-report.json) đều do script sinh ra.

| ID | Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| P4-1 | Contract v1.3 có `bench_cmd`, `soak_cmd`; giữ mọi yêu cầu v1.0–v1.2 | `contract.test.js`. Chạy nguyên `tests/` của `phase-3` trên code mới: 80/81 đạt, test đỏ duy nhất là test số phiên bản contract (đã sửa kèm `P4:`) | [proof.md §1](proof.md), [test-report.txt](test-report.txt) | Đạt |
| P4-2 | Soak 10 Đêm 1 → 2 → 3, seed 7 + i, input ngẫu nhiên theo seed; `crashes = 0`, RSS cuối ≤ 1,2 × đầu | Đúng lệnh contract: 0 crash, RSS 41,6 → 45,6 MB (×1,10), heap JS 4,4 → 4,8 MB. Test kiểm tra 10 Đêm, seed 7…16, tỉ lệ input 5/3/2/10 %, tính tất định. Chạy đối chứng `--jit`: kết quả giống hệt | [proof.md §7](proof.md), [runs/soak.json](runs/soak.json), [`soak.json`](../../../soak.json) | Đạt |
| P4-3 | Cảnh bench chuẩn: 200 Bóng Mực wander, 100 đom đóm, L1–L3 fuel 100; tắt sinh, sát thương, nhặt, hao dầu, kết thúc; Mây đứng ở (0,0,0); camera r = 30 m, y = 15 m, từ (30,15,0), ngược chiều kim đồng hồ, 15 s/vòng; khởi động 3 s, đo rồi thoát mã 0 | Test chạy qua bình minh (241 s): 0 sự kiện, 200/100 thực thể, dầu vẫn 100, hơn 180 Bóng Mực có di chuyển. Test camera ở t = 0; 3,75; 7,5; 15 s. Lệnh bench thoát mã 0 | [screens/16-bench-scene.png](screens/16-bench-scene.png), [proof.md §8](proof.md) | Đạt |
| P4-4 | `bench.json` đủ trường, công thức avg / 1 % low / p95 đúng | Test toán với dữ liệu biết trước (N = 200 → k = 2; N = 3 → k = 1; p95 theo nearest-rank) | [runs/bench.json](runs/bench.json), [`bench.json`](../../../bench.json) | Đạt |
| P4-5 | Cửa sổ 1280×720, tắt vsync; `load_ms`; `peak_mem_mb` | `resolution` 1280x720, cờ `--disable-gpu-vsync --disable-frame-rate-limit`, `load_ms` ≈ 1,1 s, `peak_mem_mb` đo được (tổng RSS các tiến trình trình duyệt) | [runs/bench.json](runs/bench.json) | Đạt về cách đo. **FPS chưa chứng minh được**: máy làm bài không có GPU (0,8 FPS bằng SwiftShader). Ngưỡng ≥ 60 / ≥ 30 do giảng viên đo trên máy chấm; `tools/release.js` đo lại trên máy có GPU |
| P4-6 | Nhập tên sau Bình Minh và sau khi thua; tên 3–12 `[A-Za-z0-9_]`, có tiếng Việt | Trình duyệt: "ab" bị chặn (nút Lưu khóa), "Mây_Nhỏ" và "Long_1806" được lưu. Test tên hợp lệ và không hợp lệ, chuẩn hóa NFC | [11](screens/11-name-invalid.png), [12](screens/12-board-after-loss.png), [13](screens/13-dawn-name.png), [14](screens/14-board-after-dawn.png); `checks.badName` | Đạt |
| P4-7 | Mục có name, score, nights_won, achieved_at (múi giờ), seed; top 10; điểm giảm dần; bằng điểm thì ai đạt trước đứng trên | Test thứ tự (cả khác múi giờ), cắt top 10, hạng null khi trượt top, loại mục hỏng | [test-report.txt](test-report.txt) | Đạt |
| P4-8 | Lưu trên đĩa, còn sau khi tắt/mở lại; có màn Bảng xếp hạng từ menu | Xóa sạch dữ liệu trình duyệt rồi mở lại game → menu → bảng vẫn còn 2 dòng (`checks.boardAfterReload`). Test: server mới đọc lại đúng file | [15](screens/15-board-from-menu.png) | Đạt |
| P4-9 | `<run_cmd> --export-leaderboard out.json` → `{"entries": [...]}` đúng thứ tự | Chạy đúng `node tools/serve.js --open --export-leaderboard …`: mã 0, không mở server hay trình duyệt; nội dung trùng với API | [screens/leaderboard-export.json](screens/leaderboard-export.json), `checks.exportCommand` | Đạt |
| P4-10 | Đổi phím mọi hành động, báo trùng, khôi phục mặc định, được lưu | Gán Nhảy = E → báo trùng với Tương tác → đổi chỗ. Tải lại trang: phím vẫn giữ. Trong game: Space không còn nhảy, E nhảy (`remappedJump` 0 → 0 → 1). "Khôi phục mặc định" về đủ 11 phím gốc | [03](screens/03-remap-conflict.png), [04](screens/04-remap-saved.png), [05](screens/05-remap-reset.png) | Đạt |
| P4-11 | Phụ đề và chỉ báo: Bóng Mực xuất hiện (+ mũi tên mép màn hình), gió sắp thổi, 10 s cuối, fuel < 30 | `checks.shadeSpawn` (phụ đề + 2 mũi tên), `windSubtitle`, `last10Subtitle`, `fuelSubtitle` | [06](screens/06-sub-shade.png), [07](screens/07-sub-wind.png), [08](screens/08-sub-last10.png), [09](screens/09-sub-fuel.png) | Đạt |
| P4-12 | Giảm chuyển động: không rung camera, không chớp màn hình | Cùng một cú chạm: bật giảm chuyển động → `shake` 0, không chớp; tắt → `shake` > 0, có chớp | `checks.reducedMotion`, `checks.normalMotion` | Đạt |
| P4-13 | Chữ ≥ 18 px ở 1280×720; chữ lớn ×1,25 | Cỡ chữ nhỏ nhất đo trên 6 màn (menu, cài đặt, đổi phím, HUD, kết quả, bảng xếp hạng) đều là 18 px; bật chữ lớn → 22,5 px. Test CSS chặn chữ < 18 px | [10](screens/10-large-text.png), `checks.minFontPerScreen`, `largeTextMinFont` | Đạt |
| P4-14 | Clone sạch, tối đa 3 lệnh là chơi được; README đủ mục; CHANGELOG 4 phase; CREDITS; LICENSE; Release v1.0.0 có bản chạy được | Clone commit vào thư mục tạm, chạy server: `/`, `main.js`, contract, API đều trả 200; `npm test` trong bản clone 94/94. `tools/release.js` gắn tag `phase-1`…`phase-4`, đóng gói zip, tạo Release | [proof.md §9](proof.md), [README](../../../README.md), [CHANGELOG](../../../CHANGELOG.md), [CREDITS](../../../CREDITS.md) | Đạt phần chuẩn bị. **Tag và Release do người dùng chạy** `node tools/release.js` (môi trường làm bài không đẩy được tag) |
| P4-15 | Retro 1–2 trang; video `.mp4` dưới 5 phút | Video quay từ chính game và output lệnh thật | [retro.md](../../notes/retro.md), [docs/demo/demo.mp4](../../demo/demo.mp4) | Đạt |
| P4-16 | Test ẩn Phase 1–3 còn hiệu lực vẫn đạt | Như P4-1. Scenario Phase 1–3 chạy lại qua `headless_cmd`; tất định trên cả 3 Đêm | [proof.md §1–§4](proof.md) | Đạt |

Hook vẫn chặn khi test đỏ: [harness-check.txt](harness-check.txt).
