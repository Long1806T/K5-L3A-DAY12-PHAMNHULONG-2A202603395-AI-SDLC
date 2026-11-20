# Phase 1 · bằng chứng tự sinh

> File này do `node tools/proof.js --phase 1` tạo ra, không sửa tay. Chạy lại lệnh đó ở tag `phase-1` để tái lập.

- Thời điểm: 2026-11-20T14:31:39.868Z
- Máy: Linux 6.18.44-fc-v726 · Intel(R) Xeon(R) Processor @ 2.10GHz × 2 · Node v22.23.5
- Commit khi chạy: `67a5b53` (bằng chứng được commit ngay sau commit này)

## 1. Bộ test (`npm test`)

Kết quả: **48/48 đạt**, 0 lỗi. Báo cáo đầy đủ: [test-report.txt](test-report.txt).

## 2. Scenario chạy qua đúng `headless_cmd`

| Scenario | Mục đích | Lệnh rút gọn | Sự kiện (tick:tên) | Dòng end | Mã thoát |
|---|---|---|---|---|---|
| [contract-example](runs/contract-example.jsonl) | Ví dụ scenario + inputs trong Test Contract | `--scenario contract-example.scenario.json --inputs contract-example.inputs.json --ticks 300` | 38:mote_picked, 201:pulse | `{"type":"end","ticks":300,"state":"playing","score":35}` | 0 |
| [win-last-lantern](runs/win-last-lantern.jsonl) | Đi tới L1, nạp → thắp đèn cuối → thắng | `--scenario win-last-lantern.scenario.json --inputs walk-and-interact.inputs.json --ticks 600` | 21:deposit, 21:lantern_lit, 21:game_over | `{"type":"end","ticks":21,"state":"won","score":848}` | 0 |
| [pulse](runs/pulse.jsonl) | Tỏa sáng: choáng, đẩy lùi, hồi chiêu | `--scenario pulse.scenario.json --inputs pulse.inputs.json --ticks 400` | 1:pulse, 151:pulse, 295:player_hit, 385:player_hit | `{"type":"end","ticks":400,"state":"playing","score":50}` | 0 |
| [shade-hits](runs/shade-hits.jsonl) | Bóng Mực chạm người chơi đứng yên → hết lửa | `--scenario shade-hits.scenario.json --ticks 600` | 36:player_hit, 126:player_hit, 216:player_hit, 216:game_over | `{"type":"end","ticks":216,"state":"lost","score":0}` | 0 |
| [dawn](runs/dawn.jsonl) | Hết giờ → thua (dawn) | `--scenario dawn.scenario.json --ticks 600` | 120:game_over | `{"type":"end","ticks":120,"state":"lost","score":0}` | 0 |
| [safe-zone](runs/safe-zone.jsonl) | Đứng cạnh L1: không bị chạm, Bóng Mực ở ngoài safe_radius | `--scenario safe-zone.scenario.json --ticks 900` | — | `{"type":"end","ticks":900,"state":"playing","score":0}` | 0 |

Khoảng cách nhỏ nhất từ Bóng Mực tới đèn trong run safe-zone: **4.009 m** (safe_radius = 4).

## 3. File sai định dạng → mã thoát 2

| File | Mã thoát | stderr |
|---|---|---|
| `bad-player.scenario.json` | 2 | `error: scenario.player.pos: must be [x, y, z] with 3 finite numbers` |
| `move-out-of-range.inputs.json` | 2 | `error: inputs.frames[0].move: each component must be within [-1, 1]` |
| `ticks-not-increasing.inputs.json` | 2 | `error: inputs.frames[1].tick: ticks must be strictly increasing (10 after 10)` |
| `truncated.inputs.json` | 2 | `error: inputs: invalid JSON (Expected ',' or ']' after array element in JSON at position 41 (line 1 column 42))` |
| `unknown-lantern.scenario.json` | 2 | `error: scenario.lanterns[0].id: must be one of L1, L2, L3, L4, L5` |

## 4. Tính tất định

Chạy 2 lần `--seed 99 --inputs runs/determinism.inputs.json --ticks 3600`:

- lần 1 SHA-256: `035acaa0ab8f38db18448df0b8d6df9a350de24eb585465d1de2b8de2f4130fa`
- lần 2 SHA-256: `035acaa0ab8f38db18448df0b8d6df9a350de24eb585465d1de2b8de2f4130fa`
- Kết quả: **giống hệt**

## 5. Chơi trọn Đêm 1 bằng autopilot (`tools/bot.js`)

Bot chỉ điều khiển qua input như người chơi. Seed 2026 được lưu inputs để giảng viên chạy lại bằng CLI.

| Seed | Kết quả | Tick kết thúc | Điểm | Lửa còn | Đom đóm nhặt | Lần tỏa sáng | Bị chạm |
|---|---|---|---|---|---|---|---|
| 1 | won (all_lit) | 3197 | 1437 | 3 | 27 | 1 | 0 |
| 2 | won (all_lit) | 3458 | 1614 | 3 | 28 | 2 | 0 |
| 3 | won (all_lit) | 2698 | 1475 | 3 | 29 | 1 | 0 |
| 4 | won (all_lit) | 3018 | 1408 | 3 | 26 | 0 | 0 |
| 5 | won (all_lit) | 3657 | 1398 | 3 | 27 | 0 | 0 |
| 6 | won (all_lit) | 3084 | 1511 | 3 | 29 | 2 | 0 |
| 7 | won (all_lit) | 2814 | 1416 | 3 | 26 | 0 | 0 |
| 8 | won (all_lit) | 3056 | 1408 | 3 | 26 | 0 | 0 |
| 9 | won (all_lit) | 4010 | 1591 | 3 | 30 | 4 | 0 |
| 10 | won (all_lit) | 3745 | 1524 | 3 | 30 | 3 | 0 |
| 2026 | won (all_lit) | 2875 | 1424 | 3 | 27 | 0 | 0 |

Thắng 11/11 seed.

Replay qua CLI: `node src/headless.js --seed 2026 --night 1 --inputs docs/proof/phase-1/runs/bot-seed-2026.inputs.json --ticks 18000 --out out.jsonl` → `{"type":"end","ticks":2875,"state":"won","score":1424}` (trong bộ nhớ: ticks 2875, score 1424) → **khớp**

## 6. Tốc độ headless

- 18000 tick (cả đêm 5 phút) với scenario safe-zone, snapshot mỗi 10 tick: **133 ms** (gồm khởi động Node).
- Đêm mặc định, người chơi đứng yên tới khi thua: **61 ms**, kết thúc `{"type":"end","ticks":711,"state":"lost","score":0}`.

