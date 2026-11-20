# Phase 1 · PRD-0 + Test Contract v1.0

## 1. Yêu cầu → tiêu chí nghiệm thu

Mỗi dòng là một câu kiểm tra được. Cột "Kiểm chứng" trỏ tới test hoặc bằng chứng trong `docs/proof/phase-1/`.

| ID | Tiêu chí nghiệm thu | Kiểm chứng |
|---|---|---|
| AC1 | Có `game.contract.json` ở gốc repo, đủ khóa, `tuning` là đúng số game đang dùng (game đọc tuning từ chính file này) | `tests/contract.test.js` |
| AC2 | `headless_cmd --seed S --night 1 --ticks N --out f.jsonl` chạy N bước ở 60 tick/s, thoát mã 0 | `tests/headless-cli.test.js` |
| AC3 | Snapshot tick 0 = trạng thái sau khi dựng scenario; snapshot mỗi `--snapshot-every` tick (mặc định 10); dòng cuối là `end` | `tests/headless-cli.test.js` |
| AC4 | Sự kiện của bước k ghi `tick = k+1`; `time_left_s = thời lượng − bước/60`; tọa độ làm tròn 3 chữ số | `tests/headless-cli.test.js`, `tests/sim.test.js` |
| AC5 | Input: mặc định đứng yên, frame chỉ đổi trường có mặt, nút kích hoạt khi false→true, move xoay theo `cam_yaw_deg` đúng công thức, vector >1 được chuẩn hóa | `tests/sim.test.js` |
| AC6 | File inputs/scenario sai định dạng → mã thoát 2 + thông báo stderr; lỗi khác → mã khác 0 | `tests/headless-cli.test.js` |
| AC7 | Đi qua đom đóm trong `pickup_radius` thì nhặt (tối đa `carry_capacity`), mỗi con +`per_mote` điểm | `tests/sim.test.js` |
| AC8 | Bấm interact trong `interact_radius` của đèn chưa thắp → nạp; đủ `lantern_cost` thì đèn sáng, +`per_lantern` | `tests/sim.test.js` |
| AC9 | Thắp đủ 5 đèn → `game_over won all_lit`, cộng thưởng giây/lửa còn lại, dừng sớm | `tests/sim.test.js` |
| AC10 | Bóng Mực đuổi theo với `shade_speed`; chạm trong `shade_hit_radius` → mất 1 lửa, rơi `floor(carried × hit_drop_ratio)` đom đóm, bất tử `invuln_s` | `tests/sim.test.js` |
| AC11 | Hết lửa → `game_over lost no_flames`; hết giờ → `game_over lost dawn` | `tests/sim.test.js` |
| AC12 | Tỏa sáng: tốn `pulse_cost`, choáng mọi Bóng Mực trong `pulse_radius` `pulse_stun_s` giây, đẩy lùi `pulse_push_m`, hồi chiêu `pulse_cooldown_s`, +`per_stun` mỗi con | `tests/sim.test.js` |
| AC13 | Bóng Mực không bao giờ vào trong `safe_radius` quanh đèn; người chơi đứng trong vùng đó không bị chạm | `tests/sim.test.js` |
| AC14 | Tất định: cùng seed + scenario + inputs → output giống hệt từng byte, kể cả id tự sinh | `tests/determinism.test.js`, `docs/proof/phase-1/proof.md` |
| AC15 | Game có giao diện: chơi Đêm 1 từ đầu tới thắng/thua, camera 3D, nhảy, HUD, chơi lại | ảnh trong `docs/proof/phase-1/screens/`, `tools/capture.mjs` |

## 2. Giả định cho chỗ PRD-0 còn mơ hồ

| # | Chỗ mơ hồ | Giả định của tôi | Lý do |
|---|---|---|---|
| G1 | "Tỏa sáng tốn ánh sáng" tốn cái gì? | Tốn `pulse_cost` **đom đóm đang mang**. Không đủ thì không tỏa sáng được (không có sự kiện) | Đom đóm chính là "ánh sáng"; `flames` là máu |
| G2 | Đèn nào là vùng an toàn? | **Mọi** Đèn Lồng Lớn (cả chưa thắp) có `safe_radius`, đúng như câu chữ của contract "bán kính quanh đèn" | Contract là phần chính xác, không nói "đèn đã thắp" |
| G3 | Người chơi trong vùng an toàn có bị chạm không? | Không. Trong `safe_radius` của bất kỳ đèn nào thì miễn sát thương | Tên gọi "safe" và Bóng Mực "sợ đèn" |
| G4 | Hết giờ (bình minh) là thắng hay thua? | **Thua**, `reason: dawn` | PRD: thắng chỉ khi thắp hết đèn |
| G5 | Làm tròn số đom đóm rơi | `dropped = floor(carried × hit_drop_ratio)`; đom đóm rơi bay mất vào sương (không thành đom đóm mới) | Không làm đổi danh sách đom đóm trong scenario `random_motes: false` |
| G6 | Nạp đèn bao nhiêu? | `min(carried, lantern_cost − deposited)`, phần dư giữ lại cho đèn khác. Nhiều đèn trong tầm → đèn chưa thắp gần nhất | Không lãng phí đom đóm |
| G7 | Điểm | Điểm = Σ sự kiện (`mote_picked`×per_mote, `lantern_lit`×per_lantern, mỗi id trong `stunned_ids`×per_stun). Khi **thắng** cộng `floor(time_left_s)`×per_second_left + flames×per_flame_left. Thua không có thưởng | Điểm tái tạo được từ log sự kiện |
| G8 | Rơi khỏi đảo | `fall_enabled: false`: đảo có mép chắn, người chơi bị giữ trong bán kính 45 m | Giữ phạm vi Phase 1 gọn |
| G9 | Thứ tự xử lý trong một tick | input → di chuyển/nhảy → nhặt → nạp đèn (kiểm tra thắng) → tỏa sáng → Bóng Mực di chuyển → va chạm (kiểm tra thua) → sinh mới → đồng hồ (kiểm tra bình minh) | Cố định để tất định; thắng được xét trước thua trong cùng tick |
| G10 | Thời gian bất tử / choáng / hồi chiêu đổi ra tick | `round(giây × 60)`; sự kiện ở tick t thì hiệu lực đến hết tick `t + D − 1` | Đếm tick nguyên, không trôi số thực |
| G11 | Bóng Mực tự sinh | 3 con lúc đầu + 1 con mỗi 25 s (tối đa 6), xuất hiện ở rìa đảo, có trạng thái `emerge` 1 s vô hại. Bóng Mực trong scenario vào `chase` ngay | Contract: con trong scenario "hoạt động bình thường ngay lập tức" |
| G12 | Đom đóm tự sinh | 30 con lúc đầu; mỗi 2 s bổ sung 1 con nếu còn < 30 | Đủ cho 25 đom đóm cần thắp 5 đèn + tỏa sáng |
| G13 | Bóng Mực bị đẩy vào vùng an toàn hoặc ra ngoài đảo | Được đẩy ra mép vùng an toàn (cộng thêm 0,01 m) và giữ trong đảo | Đảm bảo bất biến AC13 ngay cả sau khi làm tròn tọa độ |

## 3. Con số tuning (khai trong `game.contract.json`)

| Khóa | Giá trị | Ghi chú |
|---|---|---|
| player_speed | 6.0 m/s | nhanh hơn Bóng Mực (3.5) để chạy thoát được |
| carry_capacity | 8 | đủ thắp 1 đèn (5) + vài lần tỏa sáng |
| lantern_cost | 5 | 5 đèn × 5 = 25 đom đóm |
| pickup_radius / interact_radius | 1.2 m / 2.5 m | |
| pulse_cost / radius / stun / push / cooldown | 1 / 6 m / 3 s / 4 m / 2 s | |
| night1_duration_s | 300 | 5 phút |
| flames / invuln_s / hit_drop_ratio | 3 / 1.5 s / 0.5 | |
| safe_radius | 4 m | lớn hơn interact_radius nên nạp đèn luôn an toàn |
| shade_speed / shade_hit_radius | 3.5 m/s / 0.9 m | |
| score | mote 10, lantern 100, stun 25, giây còn lại 2, lửa còn lại 50 | |

## 4. Kế hoạch kiểm chứng (viết trước khi code)

1. Logic game là module thuần (`src/core/`), không dùng `Math.random`/`Date`; trình duyệt và headless gọi **cùng một** hàm `step()`.
2. Test đơn vị dựng tình huống bằng scenario (y như cách giảng viên sinh test) rồi so với số trong `tuning`.
3. Test CLI chạy đúng `headless_cmd` trong contract, kiểm tra định dạng JSONL, mã thoát.
4. Tất định: chạy 2 lần so sánh SHA-256.
5. Giao diện: script Playwright mở game trong Chrome headless, chơi theo kịch bản, chụp ảnh HUD/thắng/thua.

## 5. Đánh giá Phase 1

- **Đạt:** 15/15 tiêu chí nghiệm thu (AC1–AC15) và harness H1, xem [bảng truy vết](../proof/phase-1/README.md). 48 test xanh. Output tất định (SHA-256 trùng). Autopilot thắng 11/11 seed, replay qua CLI ra đúng dòng `end`.
- **Chưa đạt / giới hạn:** chưa playtest bằng tay trên laptop thật, chưa có âm thanh, chưa hỗ trợ cảm ứng. Độ khó chưa cân chỉnh: bot thắng dễ vì chơi hoàn hảo.
- **Hồi quy:** không áp dụng (phase đầu).
- **AI sai ở đâu:** 7 lỗi nhỏ, đều bắt được bằng test, review diff hoặc đọc ảnh/bằng chứng sinh ra. Chi tiết trong [ai-log.md](ai-log.md).
- **Chỉnh harness:** thêm luật 7 vào `AGENTS.md` (test dài phải ở safe zone). Thêm test chặn `Math.random`/`Date` trong `src/core`, để lỗi phá tính tất định không thể lọt vào thay vì chỉ dặn bằng lời. Script `harness-check.sh` chứng minh hook chặn khi test đỏ.
- **Rủi ro cho phase sau:** contract có thể đổi (nhiều đêm, `sim_tick` ≠ `tick`). Logic đã tách theo `night` và `simTick` riêng để dễ mở rộng.
