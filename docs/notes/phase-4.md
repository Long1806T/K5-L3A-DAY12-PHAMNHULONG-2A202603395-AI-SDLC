# Phase 4 · Ticket-04 "Bình minh: phát hành v1.0.0" + Test Contract v1.3

Phase này không thay luật chơi. Phase này thêm: đo hiệu năng (bench), chạy dài (soak), bảng xếp hạng, tính năng dễ tiếp cận và đóng gói phát hành.

## 1. Test cũ bị ảnh hưởng

| Thay đổi | Test cũ: sửa hay xóa |
|---|---|
| `contract_version` lên `"1.3"`, thêm `bench_cmd` và `soak_cmd` | Sửa "contract v1.2 has the required top-level fields" thành v1.3, kèm comment `P4:`. Test này kiểm tra thêm hai lệnh mới và file của chúng |
| `npm test` chạy qua `scripts/run-tests.js`: `cmd.exe` của Windows không tự mở rộng `tests/*.test.js` | Không test nào đổi |

Mọi test Phase 1–3 khác được giữ nguyên. Proof §1 chạy lại nguyên thư mục `tests/` của `phase-3` trên code Phase 4 để chứng minh điều này.

## 2. Tiêu chí nghiệm thu

| ID | Tiêu chí | Kiểm chứng |
|---|---|---|
| P4-1 | Contract v1.3 có `bench_cmd`, `soak_cmd`; giữ mọi yêu cầu v1.0–v1.2 | `contract.test.js`, chạy lại test `phase-3` (proof §1) |
| P4-2 | Soak: `soak_cmd --seed 7 --nights 10 --out soak.json` chạy 10 Đêm trong cùng tiến trình, xoay 1 → 2 → 3, Đêm i dùng seed 7 + i, input ngẫu nhiên theo seed (30 tick đổi hướng; 5 % nhảy, 3 % lướt, 2 % tỏa sáng, 10 % tương tác). Output đúng định dạng. `crashes = 0`, `mem_end_mb ≤ 1,2 × mem_start_mb` | `release.test.js`, proof §7, `soak.json` |
| P4-3 | Cảnh bench chuẩn: Đêm 1, đúng 200 Bóng Mực wander rải đều (seed 42), đúng 100 đom đóm, L1–L3 sáng fuel 100. Tắt sinh thêm, sát thương, nhặt, hao dầu, kết thúc Đêm. Mây đứng yên ở (0,0,0). Camera r = 30 m, y = 15 m, bắt đầu ở (30,15,0), ngược chiều kim đồng hồ, 15 s/vòng. Khởi động 3 s, đo `--duration` s, tự thoát mã 0 | `release.test.js`, ảnh `16-bench-scene`, proof §8 |
| P4-4 | `bench.json` đủ trường; `avg_fps`, `p1_low_fps`, `frame_ms_p95` đúng công thức | `release.test.js` (toán), `bench.json` |
| P4-5 | Cửa sổ 1280×720 không toàn màn hình, tắt vsync; `load_ms` tính từ lúc tiến trình bắt đầu; `peak_mem_mb` là RSS cao nhất | `bench.json` (`resolution`, `window`, `browser_flags`, `peak_mem_note`) |
| P4-6 | Nhập tên sau màn Bình Minh và sau khi thua bất kỳ Đêm nào. Tên 3–12 ký tự `[A-Za-z0-9_]`, có hỗ trợ tiếng Việt có dấu (điểm cộng) | ảnh 11–14, `release.test.js` |
| P4-7 | Mục lưu gồm name, score, nights_won (0–3), achieved_at (ISO 8601 có múi giờ), seed. Giữ top 10, điểm giảm dần, bằng điểm thì ai đạt trước đứng trên | `release.test.js` |
| P4-8 | Lưu trên đĩa, còn sau khi tắt và mở lại game; có màn Bảng xếp hạng từ menu | ảnh 15 (đã xóa dữ liệu trình duyệt), `release.test.js` (server mới đọc lại file) |
| P4-9 | `<run_cmd> --export-leaderboard out.json` ghi `{"entries": [...]}` đúng thứ tự | `release.test.js`, `capture-report.json` → `exportCommand`, `leaderboard-export.json` |
| P4-10 | Đổi phím cho mọi hành động (4 hướng, nhảy, lướt, tương tác, tỏa sáng, tạm dừng); phát hiện trùng phím và báo; nút "Khôi phục mặc định"; được lưu | ảnh 03–05; `capture-report.json`: `remapConflictMessage`, `afterSwap`, `keysAfterReload`, `remappedJump`, `keysAfterReset` |
| P4-11 | Phụ đề và chỉ báo hình ảnh: Bóng Mực xuất hiện (kèm mũi tên ở mép màn hình), gió sắp thổi, 10 s cuối, đèn có fuel < 30 | ảnh 06–09; `capture-report.json` |
| P4-12 | Giảm chuyển động: không rung camera, không chớp màn hình | `capture-report.json`: `reducedMotion` so với `normalMotion` |
| P4-13 | Chữ UI ≥ 18 px ở 1280×720; tùy chọn chữ lớn ×1,25 | `release.test.js` (CSS); `capture-report.json`: `minFontPerScreen`, `largeTextMinFont` |
| P4-14 | Clone sạch, theo README tối đa 3 lệnh là chơi được. README đủ mục. CHANGELOG có 4 phase. CREDITS đủ. Có LICENSE. Release v1.0.0 có bản chạy được | thử clone sạch (proof §9), README, `tools/release.js` |
| P4-15 | Retro 1–2 trang; video demo `.mp4` dưới 5 phút | [retro.md](retro.md), `docs/demo/demo.mp4` |
| P4-16 | Test ẩn Phase 1–3 còn hiệu lực vẫn đạt | proof §1 (test của `phase-3` trên code mới) |

## 3. Giả định cho chỗ ticket chưa nói rõ

| # | Chỗ chưa rõ | Giả định |
|---|---|---|
| L1 | "Đêm thứ i dùng seed 7 + i" | i đếm từ 0, nên 10 Đêm dùng seed 7…16 (Đêm đầu dùng đúng `--seed`). `soak.json` ghi seed của từng Đêm trong `detail` |
| L2 | Input ngẫu nhiên của soak | Hướng đi là vector đơn vị, góc chọn đều. Bốn nút được bốc độc lập mỗi tick. Luồng RNG riêng `soak-input|<seed>`, camera yaw 0 |
| L3 | Lúc đo `mem_start_mb`, `mem_end_mb` | Start: ngay sau khi tạo thế giới Đêm đầu, chưa chạy tick nào. End: Đêm cuối đã kết thúc và thế giới đã được giải phóng. Mỗi lần đo chạy 2 lần GC toàn phần trước, để RSS không phụ thuộc lúc GC chạy. Lý do tắt JIT tối ưu: xem §4 |
| L4 | "Rải đều trên đảo" | Phân bố đều theo diện tích trên đĩa bán kính (r đảo − 3 m), r = R·√u. Bóng Mực và đom đóm dùng hai luồng seed riêng. Không né vùng an toàn: Bóng Mực rơi vào đó bị đẩy ra theo luật thường |
| L5 | "Bóng Mực di chuyển theo luật wander bình thường" | Dùng đúng luật của game: Bóng Mực wander bay tới đèn chưa sáng gần nhất (L4, L5). Con nào tới gần Mây trong 12 m thì chuyển sang chase như luật thường; sát thương đã tắt nên không có gì xảy ra. Không đèn nào yếu nên không có drain |
| L6 | Cách tắt các hệ thống trong bench | Bench dùng bộ tuning riêng (`benchTuning`: bán kính chạm −1, bán kính nhặt −1, hao dầu 0, hút dầu 0, Đêm dài 10⁷ s) và scenario `random_* = false`. Không sửa `src/core/`, nên output headless không đổi |
| L7 | "Ngược chiều kim đồng hồ khi nhìn từ trên xuống" | Hệ tọa độ tay phải, Y hướng lên. Quay dương quanh +Y: (30 cos θ, 15, −30 sin θ). Sau ¼ vòng (3,75 s) camera ở (0, 15, −30). Test chốt điều này |
| L8 | dt của từng khung, cửa sổ đo | dt lấy từ timestamp của `requestAnimationFrame`. Cửa sổ đo bắt đầu ở khung đầu tiên có t ≥ 3 s, gồm mọi khung tới khi đủ `--duration` (khung cuối có thể vượt chút ít). p95 tính theo nearest-rank |
| L9 | "Từ lúc tiến trình bắt đầu" (`load_ms`) | Tiến trình là `node tools/bench.js` (`performance.timeOrigin` của Node). Mốc kết thúc là khung đầu của cảnh bench (`performance.timeOrigin` + timestamp của trang). Số này gồm cả thời gian mở trình duyệt |
| L10 | `peak_mem_mb` của bản web | Đo được, không để null: lấy RSS của mọi tiến trình trình duyệt của chính phiên bench (profile riêng: browser + GPU + renderer), mẫu mỗi 0,5 s trong lúc đo, rồi cộng lại. Các tiến trình dùng chung trang nhớ nên đây là cận trên. Windows dùng WorkingSetSize, mẫu mỗi 2 s |
| L11 | Cửa sổ 1280×720, vsync | Mở bằng `--app` + `--window-size=1280,720`. Bộ đệm vẽ cố định 1280×720, kể cả khi khung cửa sổ ăn mất vài chục px hoặc DPR ≠ 1. Tắt vsync bằng `--disable-gpu-vsync --disable-frame-rate-limit`. Linux không có màn hình thì tự dùng Xvfb; không có Xvfb thì dùng `--headless=new` (ghi trong trường `window`) |
| L12 | Điểm, số Đêm thắng, seed của mục bảng xếp hạng | score = tổng điểm các Đêm đã thắng trong lượt chơi. nights_won = số Đêm thắng trong lượt (vào thẳng Đêm 3 rồi thắng thì = 1). seed = seed của Đêm vừa kết thúc lượt. Một tổng điểm chỉ lưu một lần: thua, lưu, chơi lại rồi thua tiếp thì không lưu trùng |
| L13 | Đếm ký tự của tên, tiếng Việt | Chuẩn hóa NFC, bỏ khoảng trắng đầu và cuối. Đếm 3–12 theo code point. Cho phép chữ cái mọi bảng chữ (gồm tiếng Việt có dấu), chữ số và `_` |
| L14 | "Bằng điểm thì ai đạt trước" | So `achieved_at` theo thời điểm tuyệt đối, nên khác múi giờ vẫn so đúng. Trùng cả thời điểm thì mục lưu trước đứng trên |
| L15 | Nơi lưu "trên đĩa cục bộ" | `data/leaderboard.json` cạnh game (đổi bằng `DDL_DATA_DIR`), ghi nguyên tử. Nếu trang chạy không có `tools/serve.js` thì lưu vào localStorage và báo rõ trên màn hình. `--export-leaderboard` đọc file trên đĩa; chưa có file thì ra `{"entries": []}`. Lệnh này không mở server hay trình duyệt, dù `run_cmd` có `--open` |
| L16 | Phím đặc biệt khi đổi phím | Esc luôn là tạm dừng / quay lại, không gán được. Shift trái và phải tính là một phím. Trùng phím thì chưa gán: game báo và đề nghị đổi chỗ hai phím |
| L17 | Phụ đề | Bật sẵn, tắt được trong Cài đặt. Khi Bóng Mực xuất hiện: mũi tên tím ở mép màn hình chỉ từng con (đang thấy trên màn hình thì hiện ⚠ trên đầu), giữ 3,5 s |
| L18 | Giảm chuyển động | Tắt rung camera và chớp màn hình. Nhịp nhấp nháy 1 Hz của đèn yếu vẫn giữ, vì đó là chỉ báo bắt buộc của Ticket-03 (chậm, không phải chớp cả màn hình) |

## 4. Ghi chú đo hiệu năng và bộ nhớ

- **Bench trên máy làm bài không có GPU.** Container chỉ có SwiftShader (WebGL chạy trên CPU, 2 nhân). Số trong `bench.json` của repo vì vậy rất thấp và **không dùng để kết luận đạt hay không**. Ngưỡng avg ≥ 60 / 1 % low ≥ 30 do giảng viên đo trên máy chấm có GPU. `node tools/release.js` chạy lại bench trên máy của bạn và commit số thật trước khi gắn tag `phase-4`.
- Khi đo trong cửa sổ Xvfb, phần lớn khung chỉ tốn vài ms để JavaScript gửi lệnh vẽ. Thỉnh thoảng có khung dừng tới hơn 10 s: hàng đợi lệnh GPU bị đầy và JavaScript phải chờ SwiftShader vẽ xong. Chạy cùng bản build ở chế độ headless (`--headless`) thì mọi khung đều khoảng 0,6–0,9 s, không có khung dừng dài. Vì vậy các khung dừng dài là do Xvfb và SwiftShader, không phải do game.
- **Soak tắt JIT tối ưu của V8** (`--no-opt --no-maglev`, đặt trong `tools/soak.js`). Cùng 10 Đêm, khi bật JIT (`--jit`), RSS tăng từ khoảng 41 lên 88 MB, và lên khoảng 120 MB sau 30 Đêm. Trong khi đó heap JS của game đứng yên (khoảng 4–5 MB). Phần tăng là bộ nhớ biên dịch của TurboFan/Maglev nằm trong arena của `malloc`, không được trả lại hệ điều hành. Đó không phải bộ nhớ của game. Tắt JIT tối ưu thì RSS phản ánh đúng game: 41 → 45 MB. Kết quả ván chơi giống hệt ở cả hai chế độ. Proof §7 ghi cả hai lần chạy.

## 5. Đánh giá Phase 4

- **Đạt:** 14/16 tiêu chí đạt trọn ([bảng truy vết](../proof/phase-4/README.md)).
  - 94 test xanh.
  - Test của `phase-3` chạy trên code mới: 80/81 đạt; test đỏ duy nhất là test số phiên bản contract, đã sửa kèm `P4:`.
  - Soak: 0 crash, RSS ×1,10.
  - Bảng xếp hạng, đổi phím, phụ đề, giảm chuyển động và chữ lớn đều được kiểm tra bằng thao tác thật trong trình duyệt.
  - Clone sạch → 3 lệnh → chơi được.
- **Chưa chứng minh được ở đây** (ghi thật):
  - P4-5, FPS ≥ 60: máy làm bài không có GPU, bench chỉ được 0,8 FPS bằng SwiftShader. Cách đo đúng ticket; số thật do máy chấm đo, và `tools/release.js` đo lại trên máy có GPU.
  - P4-14, tag và Release: môi trường làm bài không đẩy được tag, nên người dùng chạy `node tools/release.js` trên máy của mình.
- **AI sai:** #21–#30 trong [ai-log.md](ai-log.md). Hai lỗi đáng nhớ nhất:
  - Suýt "sửa" một chỗ rò bộ nhớ không có thật (#21).
  - Chữ < 18 px tồn từ Phase 1–2 (#26).
- **Chỉnh harness:**
  - Luật 9 (chữ ≥ 18 px, có test chặn) và luật 10 (so heap với RSS) trong `AGENTS.md`.
  - `npm test` chạy được trên Windows.
  - Proof thêm soak/bench đúng lệnh contract và bước clone sạch.
  - Capture thêm thao tác đổi phím, bảng xếp hạng và đo cỡ chữ.
