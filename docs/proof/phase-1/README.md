# Phase 1 · Truy vết yêu cầu → bằng chứng

Tag: `phase-1`. Chạy lại toàn bộ: `npm test && npm run proof -- --phase 1` (ảnh: `node tools/capture.mjs`).
Số liệu trong [proof.md](proof.md) và [test-report.txt](test-report.txt) do tool sinh ra, không sửa tay.

| ID | Yêu cầu (PRD-0 / Contract v1.0) | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| AC1 | `game.contract.json` đủ khóa; tuning đúng số game dùng | `tests/contract.test.js`: kiểm tra khóa; headless đọc tuning từ chính file | [test-report.txt](test-report.txt) | Đạt |
| AC2 | `headless_cmd … --ticks N --out` chạy N bước, exit 0 | `tests/headless-cli.test.js` gọi đúng `headless_cmd` | test-report, [proof.md §2](proof.md) | Đạt |
| AC3 | Snapshot tick 0 + mỗi `--snapshot-every`; dòng `end` cuối | test "runs N ticks…", "--snapshot-every…" | test-report | Đạt |
| AC4 | Tick model (event ghi k+1), `time_left_s`, làm tròn 3 số | test CLI + "snapshot coordinates are rounded…" | test-report, [runs/contract-example.jsonl](runs/contract-example.jsonl) | Đạt |
| AC5 | Inputs: mặc định, giữ trường cũ, nút theo cạnh lên, xoay theo yaw, chuẩn hóa | 6 test trong `sim.test.js` (movement & input) | test-report | Đạt |
| AC6 | File sai → exit 2 + stderr; lỗi khác ≠ 0 | 6 file lỗi trong `scenarios/phase1/bad/` + 4 lỗi tham số | [proof.md §3](proof.md) | Đạt |
| AC7 | Nhặt đom đóm trong `pickup_radius`, giới hạn `carry_capacity`, +điểm | 3 test pickup (đúng biên 1,2 m, nhặt ở tick 38 khi đi tới) | test-report, runs/contract-example (`38:mote_picked`) | Đạt |
| AC8 | Nạp đèn trong `interact_radius`, đủ `lantern_cost` thì sáng | 4 test deposit (đủ, thiếu, dư, ngoài tầm, giữ nút) | test-report | Đạt |
| AC9 | Thắp đủ 5 đèn → thắng `all_lit`, có thưởng, dừng sớm | test "lighting the last lantern…", run win-last-lantern | [runs/win-last-lantern.jsonl](runs/win-last-lantern.jsonl), [screens/04-won.png](screens/04-won.png) | Đạt |
| AC10 | Bóng Mực đuổi `shade_speed`; chạm → −1 lửa, rơi `floor(carried×0,5)`, bất tử `invuln_s` | 3 test (tốc độ, tick bị chạm, khoảng cách giữa 2 lần chạm = 90 tick) | test-report, [runs/shade-hits.jsonl](runs/shade-hits.jsonl) | Đạt |
| AC11 | Hết lửa → `lost no_flames`; hết giờ → `lost dawn` | test + run shade-hits, dawn | runs/shade-hits, [runs/dawn.jsonl](runs/dawn.jsonl), [screens/07-lost.png](screens/07-lost.png) | Đạt |
| AC12 | Tỏa sáng: tốn 1, choáng 3 s, đẩy 4 m, hồi 2 s, +25/con | 3 test pulse + run pulse | [runs/pulse.jsonl](runs/pulse.jsonl), [screens/06-pulse.png](screens/06-pulse.png) | Đạt |
| AC13 | Bóng Mực không vào `safe_radius`; người trong vùng không bị chạm | test kiểm mọi snapshot trong 900 tick; run safe-zone (khoảng cách nhỏ nhất 4,009 m) | [runs/safe-zone.jsonl](runs/safe-zone.jsonl), [screens/08-safe-zone.png](screens/08-safe-zone.png) | Đạt |
| AC14 | Tất định: cùng đầu vào → output giống hệt | 2 lần chạy so SHA-256; seed khác → đảo khác; replay autopilot qua CLI khớp | [proof.md §4, §5](proof.md) | Đạt |
| AC15 | Chơi được Đêm 1 từ đầu tới thắng/thua; camera 3D, nhảy, HUD, chơi lại | `tools/capture.mjs` chơi trong Chrome headless (WebGL SwiftShader), đọc state của chính trang; autopilot thắng 11/11 seed | [screens/](screens/) + [capture-report.json](screens/capture-report.json), [proof.md §5](proof.md) | Đạt |
| H1 | Harness chặn kết thúc/commit khi test đỏ | `scripts/harness-check.sh` cố tình thêm test đỏ | [harness-check.txt](harness-check.txt) | Đạt |

## Chưa đạt / giới hạn (ghi trung thực)

- **Chưa có người chơi thử bằng tay trên máy thật**: phần giao diện được kiểm bằng Playwright + Chrome headless (render phần mềm). Chưa đo FPS trên laptop thật (để Phase 4 nếu ticket yêu cầu hiệu năng).
- **Chưa có âm thanh** (PRD-0 không bắt buộc).
- **Chưa hỗ trợ cảm ứng/tay cầm**: chỉ có bàn phím và chuột.
- Autopilot thắng mọi seed đã thử vì nó chơi "hoàn hảo"; người chơi thật sẽ khó hơn. Độ khó chưa được cân chỉnh bằng playtest.
