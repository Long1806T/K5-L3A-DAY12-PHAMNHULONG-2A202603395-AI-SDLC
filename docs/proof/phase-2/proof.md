# Phase 2 · bằng chứng tự sinh

> File này do `node tools/proof.js --phase 2` tạo ra, không sửa tay. Chạy lại lệnh đó ở tag `phase-2` để tái lập.

- Thời điểm: 2026-11-20T15:24:04.824Z
- Máy: Linux 6.18.44-fc-v726 · Intel(R) Xeon(R) Processor @ 2.10GHz × 2 · Node v22.23.5
- Commit khi chạy: `017dba6` (bằng chứng được commit ngay sau commit này)

## 1. Bộ test (`npm test`)

Kết quả: **70/70 đạt**, 0 lỗi. Báo cáo đầy đủ: [test-report.txt](test-report.txt).

## 2. Scenario chạy qua đúng `headless_cmd`

| Scenario | Đêm | Mục đích | Lệnh rút gọn | Sự kiện (tick:tên) | Dòng end | Mã thoát |
|---|---|---|---|---|---|---|
| [dash](runs/dash.jsonl) | 1 | Lướt 14 m/s × 12 tick, hồi 90 tick | `--scenario dash.scenario.json --inputs dash.inputs.json --ticks 120` | 11:dash, 101:dash | `{"type":"end","ticks":120,"state":"playing","score":0}` | 0 |
| [fall](runs/fall.jsonl) | 1 | Rơi khỏi đảo → mất lửa + đom đóm, hồi sinh sau 60 tick | `--scenario fall.scenario.json --inputs fall.inputs.json --ticks 260` | 70:player_hit | `{"type":"end","ticks":260,"state":"playing","score":0}` | 0 |
| [pad-night2](runs/pad-night2.jsonl) | 2 | Bục nhảy Đêm 2 → đáp đảo B | `--scenario pad-night2.scenario.json --inputs pad-night2.inputs.json --ticks 160` | — | `{"type":"end","ticks":160,"state":"playing","score":0}` | 0 |
| [pad-night3](runs/pad-night3.jsonl) | 3 | Bục nhảy Đêm 3 → đáp tầng 2 | `--scenario pad-night3.scenario.json --inputs pad-night3.inputs.json --ticks 120` | — | `{"type":"end","ticks":120,"state":"playing","score":0}` | 0 |
| [drifter-steal](runs/drifter-steal.jsonl) | 2 | Gió Lạc cướp 3 đom đóm, bỏ chạy 240 tick, biến mất | `--scenario drifter-steal.scenario.json --ticks 330` | 76:drifter_steal | `{"type":"end","ticks":330,"state":"playing","score":0}` | 0 |
| [drifter-pulse-chase](runs/drifter-pulse-chase.jsonl) | 2 | Tỏa Sáng trúng Gió Lạc đang đuổi → bỏ chạy không cướp | `--scenario drifter-pulse-chase.scenario.json --inputs pulse-now.inputs.json --ticks 300` | 1:pulse | `{"type":"end","ticks":300,"state":"playing","score":0}` | 0 |
| [drifter-pulse-loot](runs/drifter-pulse-loot.jsonl) | 2 | Tỏa Sáng trúng Gió Lạc mang đồ → thả lại 3 đom đóm | `--scenario drifter-pulse-loot.scenario.json --inputs pulse-now.inputs.json --ticks 200` | 1:pulse, 1:drifter_drop | `{"type":"end","ticks":200,"state":"playing","score":0}` | 0 |
| [charm](runs/charm.jsonl) | 2 | Bùa Gió: 7,2 m/s, lướt không hồi chiêu, xuất hiện lại sau 2700 tick | `--scenario charm.scenario.json --inputs charm.inputs.json --ticks 2720` | 10:charm_picked, 21:dash, 41:dash | `{"type":"end","ticks":2720,"state":"playing","score":0}` | 0 |
| [wind](runs/wind.jsonl) | 3 | Gió mạnh Đêm 3 tại sim tick 1800–2099 | `--scenario wind.scenario.json --ticks 2110` | — | `{"type":"end","ticks":2110,"state":"playing","score":0}` | 0 |
| [pause](runs/pause.jsonl) | 1 | Tạm dừng: tick tăng, sim_tick đứng yên | `--scenario pause.scenario.json --inputs pause.inputs.json --ticks 120` | 31:paused, 91:resumed | `{"type":"end","ticks":120,"state":"playing","score":0}` | 0 |
| [safe-zone-expel](runs/safe-zone-expel.jsonl) | 1 | Đèn vừa sáng đẩy Bóng Mực ra mép 6 m trong 30 tick | `--scenario safe-zone-expel.scenario.json --inputs interact-now.inputs.json --ticks 300` | 1:deposit, 1:lantern_lit | `{"type":"end","ticks":300,"state":"playing","score":200}` | 0 |
| [hit-drop](runs/hit-drop.jsonl) | 1 | Bị chạm: đom đóm rơi ra vành, tồn tại 480 tick | `--scenario hit-drop.scenario.json --ticks 500` | 15:player_hit, 105:player_hit, 195:player_hit, 285:player_hit, 375:player_hit, 465:player_hit | `{"type":"end","ticks":500,"state":"playing","score":0}` | 0 |
| [contract-example](runs/contract-example.jsonl) | 1 | Ví dụ scenario + inputs trong Test Contract | `--scenario contract-example.scenario.json --inputs contract-example.inputs.json --ticks 300` | 40:mote_picked, 233:player_hit | `{"type":"end","ticks":300,"state":"playing","score":0}` | 0 |
| [win-last-lantern](runs/win-last-lantern.jsonl) | 1 | Đi tới L1, nạp → thắp đèn cuối → thắng | `--scenario win-last-lantern.scenario.json --inputs walk-and-interact.inputs.json --ticks 600` | 21:deposit, 21:lantern_lit, 21:game_over | `{"type":"end","ticks":21,"state":"won","score":948}` | 0 |
| [pulse](runs/pulse.jsonl) | 1 | Tỏa sáng: choáng, đẩy lùi, hồi chiêu | `--scenario pulse.scenario.json --inputs pulse.inputs.json --ticks 400` | 1:pulse, 220:player_hit, 310:player_hit, 400:player_hit, 400:game_over | `{"type":"end","ticks":400,"state":"lost","score":10}` | 0 |
| [shade-hits](runs/shade-hits.jsonl) | 1 | Bóng Mực chạm người chơi đứng yên → hết lửa | `--scenario shade-hits.scenario.json --ticks 600` | 30:player_hit, 120:player_hit, 210:player_hit, 210:game_over | `{"type":"end","ticks":210,"state":"lost","score":0}` | 0 |
| [dawn](runs/dawn.jsonl) | 1 | Hết giờ → thua (dawn) | `--scenario dawn.scenario.json --ticks 600` | 120:game_over | `{"type":"end","ticks":120,"state":"lost","score":0}` | 0 |
| [safe-zone](runs/safe-zone.jsonl) | 1 | Đứng cạnh L1 đã sáng: không bị chạm, Bóng Mực ở ngoài safe_radius | `--scenario safe-zone.scenario.json --ticks 900` | — | `{"type":"end","ticks":900,"state":"playing","score":0}` | 0 |

Khoảng cách nhỏ nhất từ Bóng Mực tới đèn đã sáng trong run safe-zone: **6.009 m** (safe_radius = 6).

## 3. File sai định dạng → mã thoát 2

| File | Mã thoát | stderr |
|---|---|---|
| `bad-player.scenario.json` | 2 | `error: scenario.player.pos: must be [x, y, z] with 3 finite numbers` |
| `move-out-of-range.inputs.json` | 2 | `error: inputs.frames[0].move: each component must be within [-1, 1]` |
| `ticks-not-increasing.inputs.json` | 2 | `error: inputs.frames[1].tick: ticks must be strictly increasing (10 after 10)` |
| `truncated.inputs.json` | 2 | `error: inputs: invalid JSON (Expected ',' or ']' after array element in JSON at position 41 (line 1 column 42))` |
| `unknown-lantern.scenario.json` | 2 | `error: scenario.lanterns[0].id: must be one of L1, L2, L3, L4, L5` |
| `bad-shade-state.scenario.json` | 2 | `error: scenario.shades[0].state: must be one of spawning, wander, chase, recoil, stunned` |
| `pause-not-bool.inputs.json` | 2 | `error: inputs.frames[0].pause: must be true or false` |

## 4. Tính tất định

Chạy 2 lần `--seed 99 --inputs runs/determinism.inputs.json --ticks 3600` cho từng Đêm:

| Đêm | SHA-256 lần 1 | SHA-256 lần 2 | Kết quả |
|---|---|---|---|
| 1 | `07f40ffbe7442c86…` | `07f40ffbe7442c86…` | **giống hệt** |
| 2 | `e46379e3d73daf50…` | `e46379e3d73daf50…` | **giống hệt** |
| 3 | `715b8cb54db9d05e…` | `715b8cb54db9d05e…` | **giống hệt** |

## 5. Chơi trọn Đêm bằng autopilot (`tools/bot.js`, Đêm 1–2)

Bot chỉ điều khiển qua input như người chơi. Lượt thắng đầu tiên của Đêm 1 được lưu inputs để giảng viên chạy lại bằng CLI.

| Đêm/Seed | Kết quả | Tick kết thúc | Điểm | Lửa còn | Đom đóm nhặt | Lần tỏa sáng | Bị chạm |
|---|---|---|---|---|---|---|---|
| 1/1 | won (all_lit) | 11600 | 1387 | 3 | 62 | 4 | 0 |
| 1/2 | won (all_lit) | 15993 | 1286 | 3 | 77 | 9 | 0 |
| 1/3 | won (all_lit) | 12230 | 1362 | 3 | 62 | 4 | 0 |
| 1/4 | won (all_lit) | 13547 | 1343 | 3 | 71 | 7 | 0 |
| 1/5 | lost (dawn) | 18000 | 925 | 2 | 92 | 14 | 1 |
| 1/6 | lost (dawn) | 18000 | 930 | 3 | 90 | 14 | 0 |
| 1/7 | won (all_lit) | 8871 | 1459 | 3 | 53 | 1 | 0 |
| 1/8 | won (all_lit) | 10451 | 1415 | 3 | 59 | 3 | 0 |
| 1/9 | lost (dawn) | 18000 | 935 | 3 | 87 | 15 | 0 |
| 1/10 | won (all_lit) | 13951 | 1369 | 3 | 74 | 8 | 0 |
| 2/1 | lost (dawn) | 19800 | 940 | 1 | 92 | 10 | 1 |
| 2/2 | lost (dawn) | 19800 | 1070 | 2 | 88 | 9 | 1 |
| 2/3 | lost (dawn) | 19800 | 855 | 3 | 91 | 7 | 0 |
| 2/4 | lost (dawn) | 19800 | 695 | 2 | 94 | 9 | 1 |
| 2/5 | lost (dawn) | 19800 | 695 | 1 | 87 | 12 | 2 |
| 2/6 | won (all_lit) | 19503 | 1468 | 3 | 87 | 7 | 0 |
| 2/7 | lost (dawn) | 19800 | 910 | 2 | 90 | 8 | 0 |
| 2/8 | lost (no_flames) | 15346 | 870 | 0 | 70 | 8 | 3 |
| 2/9 | lost (no_flames) | 16020 | 855 | 0 | 72 | 6 | 2 |
| 2/10 | lost (dawn) | 19800 | 605 | 2 | 88 | 21 | 1 |

Thắng 8/20 lượt. Bot điều hướng đơn giản (không leo tầng Đêm 3), nên tỉ lệ thắng của bot không phải độ khó thật của game.

Replay qua CLI: `node src/headless.js --seed 1 --night 1 --inputs docs/proof/phase-2/runs/bot-night1-seed1.inputs.json --ticks 21600 --out out.jsonl` → `{"type":"end","ticks":11600,"state":"won","score":1387}` (trong bộ nhớ: ticks 11600, score 1387) → **khớp**

## 6. Tốc độ headless (yêu cầu: một Đêm đầy đủ ≤ 30 s)

| Đêm | Lệnh | Thời gian (gồm khởi động Node) | Dòng end |
|---|---|---|---|
| 1 | `--scenario survive-night1 --ticks 18000` (Mây đứng trong vùng an toàn của L1, mọi thứ khác tự sinh) | **318 ms** | `{"type":"end","ticks":18000,"state":"lost","score":0}` |
| 2 | `--scenario survive-night2 --ticks 19800` (Mây đứng trong vùng an toàn của L1, mọi thứ khác tự sinh) | **475 ms** | `{"type":"end","ticks":19800,"state":"lost","score":0}` |
| 3 | `--scenario survive-night3 --ticks 21600` (Mây đứng trong vùng an toàn của L1, mọi thứ khác tự sinh) | **528 ms** | `{"type":"end","ticks":21600,"state":"lost","score":0}` |

