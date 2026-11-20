# Phase 3 · bằng chứng tự sinh

> File này do `node tools/proof.js --phase 3` tạo ra, không sửa tay. Chạy lại lệnh đó ở tag `phase-3` để tái lập.

- Thời điểm: 2026-11-20T15:47:59.657Z
- Máy: Linux 6.18.44-fc-v726 · Intel(R) Xeon(R) Processor @ 2.10GHz × 2 · Node v22.23.5
- Commit khi chạy: `bfc4988` (bằng chứng được commit ngay sau commit này)

## 1. Bộ test (`npm test`)

Kết quả: **81/81 đạt**, 0 lỗi. Báo cáo đầy đủ: [test-report.txt](test-report.txt).

### Test của `phase-2` chạy trên code hiện tại (hồi quy)

Lấy nguyên thư mục `tests/` của `phase-2` (`git archive phase-2 tests`) chạy trên code hiện tại: **58/70 vẫn đạt**, 12 test đỏ. Đối chiếu từng test đỏ với bảng "luật bị thay" ở [phase-3.md §1](../../notes/phase-3.md); bản mới của chúng nằm trong bộ test ở trên, kèm comment `P3:` hoặc ghi lý do xóa.

- contract v1.1 has the required top-level fields
- tuning equals the Ticket-02 standard numbers
- autopilot wins a full night and the CLI replays it to the same end line
- runs N ticks, snapshot every 10 from tick 0, end line last, exit 0
- winning via walk + interact ends with state won
- --night 2 and --night 3 load their own maps and durations (P2-4)
- Night 2: two islands + bamboo bridge, 6 lanterns, pads, charm on the bridge
- interact within 2.0 m deposits min(carried, missing); at 10 the lantern lights (+10/mote, +100)
- lanterns remember partial progress; extra light stays with the player
- buttons trigger on false→true only; equal distance → smaller id
- lighting the last lantern wins: +floor(time left)×2 + 50×flames; pre-lit lanterns score nothing
- all lanterns lit on the very tick time runs out still wins (P2 order)

## 2. Scenario chạy qua đúng `headless_cmd`

| Scenario | Đêm | Mục đích | Lệnh rút gọn | Sự kiện (tick:tên) | Dòng end | Mã thoát |
|---|---|---|---|---|---|---|
| [fuel-out](runs/fuel-out.jsonl) | 1 | Đèn còn 1,5 dầu → tắt ở tick 90 (lantern_out) | `--scenario fuel-out.scenario.json --ticks 100` | 90:lantern_out | `{"type":"end","ticks":100,"state":"playing","score":0}` | 0 |
| [refuel](runs/refuel.jsonl) | 1 | Châm dầu: dùng 6 đom đóm, fuel về 100 | `--scenario refuel.scenario.json --inputs interact-now.inputs.json --ticks 5` | 1:refuel | `{"type":"end","ticks":5,"state":"playing","score":30}` | 0 |
| [relight](runs/relight.jsonl) | 1 | Thắp lại đèn từng sáng: 5 đom đóm, relight: true | `--scenario relight.scenario.json --inputs interact-now.inputs.json --ticks 3` | 1:deposit, 1:lantern_lit | `{"type":"end","ticks":3,"state":"playing","score":65}` | 0 |
| [drain](runs/drain.jsonl) | 1 | Bóng Mực hút đèn yếu: fuel_drain mỗi 60 tick, tắt ở tick 251 | `--scenario drain.scenario.json --ticks 300` | 61:fuel_drain, 121:fuel_drain, 181:fuel_drain, 241:fuel_drain, 251:lantern_out | `{"type":"end","ticks":300,"state":"playing","score":0}` | 0 |
| [drain-refuel](runs/drain-refuel.jsonl) | 1 | Châm dầu lên ≥ 30: Bóng Mực về wander, bị đẩy ra mép | `--scenario drain-refuel.scenario.json --inputs interact-now.inputs.json --ticks 120` | 1:refuel | `{"type":"end","ticks":120,"state":"playing","score":40}` | 0 |
| [dawn-win](runs/dawn-win.jsonl) | 1 | Bình minh, 3/5 đèn sáng → thắng dawn_survived | `--scenario dawn-win.scenario.json --ticks 100` | 60:game_over | `{"type":"end","ticks":60,"state":"won","score":597}` | 0 |
| [dawn-lose](runs/dawn-lose.jsonl) | 1 | Bình minh, 2/5 đèn sáng → thua dawn | `--scenario dawn-lose.scenario.json --ticks 100` | 60:game_over | `{"type":"end","ticks":60,"state":"lost","score":0}` | 0 |
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
| [safe-zone-expel](runs/safe-zone-expel.jsonl) | 1 | Đèn vừa sáng đẩy Bóng Mực ra mép 6 m trong 30 tick | `--scenario safe-zone-expel.scenario.json --inputs interact-now.inputs.json --ticks 300` | 1:deposit, 1:lantern_lit | `{"type":"end","ticks":300,"state":"playing","score":150}` | 0 |
| [hit-drop](runs/hit-drop.jsonl) | 1 | Bị chạm: đom đóm rơi ra vành, tồn tại 480 tick | `--scenario hit-drop.scenario.json --ticks 500` | 15:player_hit, 105:player_hit, 195:player_hit, 285:player_hit, 375:player_hit, 465:player_hit | `{"type":"end","ticks":500,"state":"playing","score":0}` | 0 |
| [contract-example](runs/contract-example.jsonl) | 1 | Ví dụ scenario + inputs trong Test Contract | `--scenario contract-example.scenario.json --inputs contract-example.inputs.json --ticks 300` | 40:mote_picked, 233:player_hit | `{"type":"end","ticks":300,"state":"playing","score":0}` | 0 |
| [win-last-lantern](runs/win-last-lantern.jsonl) | 1 | Đi tới L1, nạp → thắp đèn cuối → thắng | `--scenario win-last-lantern.scenario.json --inputs walk-and-interact.inputs.json --ticks 600` | 21:deposit, 21:lantern_lit | `{"type":"end","ticks":600,"state":"playing","score":150}` | 0 |
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
| `bad-shade-state.scenario.json` | 2 | `error: scenario.shades[0].state: must be one of spawning, wander, chase, recoil, stunned, drain` |
| `pause-not-bool.inputs.json` | 2 | `error: inputs.frames[0].pause: must be true or false` |
| `negative-fuel.scenario.json` | 2 | `error: scenario.lanterns[0].fuel: must be a number >= 0` |

## 4. Tính tất định

Chạy 2 lần `--seed 99 --inputs runs/determinism.inputs.json --ticks 3600` cho từng Đêm:

| Đêm | SHA-256 lần 1 | SHA-256 lần 2 | Kết quả |
|---|---|---|---|
| 1 | `1615b26cb9fd586e…` | `1615b26cb9fd586e…` | **giống hệt** |
| 2 | `3dcc73ced4159835…` | `3dcc73ced4159835…` | **giống hệt** |
| 3 | `f2eb60ce5da2bc84…` | `f2eb60ce5da2bc84…` | **giống hệt** |

## 5. Chơi trọn Đêm bằng autopilot (`tools/bot.js`, Đêm 1–2)

Bot chỉ điều khiển qua input như người chơi. Lượt thắng đầu tiên của Đêm 1 được lưu inputs để giảng viên chạy lại bằng CLI.

| Đêm/Seed | Kết quả | Tick kết thúc | Điểm | Lửa còn | Đom đóm nhặt | Lần tỏa sáng | Bị chạm |
|---|---|---|---|---|---|---|---|
| 1/1 | won (dawn_survived) | 14400 | 1228 | 3 | 67 | 4 | 0 |
| 1/2 | won (dawn_survived) | 14400 | 1075 | 3 | 74 | 9 | 0 |
| 1/3 | won (dawn_survived) | 14400 | 1060 | 3 | 72 | 4 | 0 |
| 1/4 | lost (dawn) | 14400 | 660 | 3 | 72 | 6 | 0 |
| 1/5 | won (dawn_survived) | 14400 | 1355 | 3 | 76 | 8 | 0 |
| 1/6 | lost (dawn) | 14400 | 595 | 3 | 72 | 11 | 0 |
| 1/7 | won (dawn_survived) | 14400 | 1346 | 3 | 77 | 5 | 0 |
| 1/8 | won (dawn_survived) | 14400 | 1200 | 3 | 69 | 3 | 0 |
| 1/9 | won (dawn_survived) | 14400 | 1049 | 3 | 76 | 15 | 0 |
| 1/10 | won (dawn_survived) | 14400 | 1073 | 3 | 67 | 7 | 0 |
| 2/1 | lost (dawn) | 16200 | 700 | 2 | 70 | 6 | 1 |
| 2/2 | lost (dawn) | 16200 | 535 | 2 | 65 | 6 | 1 |
| 2/3 | lost (dawn) | 16200 | 530 | 3 | 70 | 6 | 0 |
| 2/4 | lost (dawn) | 16200 | 390 | 2 | 79 | 8 | 1 |
| 2/5 | lost (dawn) | 16200 | 485 | 1 | 72 | 9 | 2 |
| 2/6 | won (dawn_survived) | 16200 | 1308 | 3 | 72 | 5 | 0 |
| 2/7 | lost (dawn) | 16200 | 595 | 3 | 72 | 6 | 0 |
| 2/8 | lost (no_flames) | 12814 | 550 | 0 | 58 | 8 | 3 |
| 2/9 | lost (no_flames) | 11965 | 505 | 0 | 54 | 6 | 3 |
| 2/10 | lost (dawn) | 16200 | 630 | 2 | 73 | 8 | 1 |

Thắng 9/20 lượt. Bot điều hướng đơn giản (không leo tầng Đêm 3), nên tỉ lệ thắng của bot không phải độ khó thật của game.

Replay qua CLI: `node src/headless.js --seed 1 --night 1 --inputs docs/proof/phase-3/runs/bot-night1-seed1.inputs.json --ticks 21600 --out out.jsonl` → `{"type":"end","ticks":14400,"state":"won","score":1228}` (trong bộ nhớ: ticks 14400, score 1228) → **khớp**

## 6. Tốc độ headless (yêu cầu: một Đêm đầy đủ ≤ 30 s)

| Đêm | Lệnh | Thời gian (gồm khởi động Node) | Dòng end |
|---|---|---|---|
| 1 | `--scenario survive-night1 --ticks 14400` (Mây có 999 Ngọn Lửa để sống tới bình minh, mọi thứ khác tự sinh) | **283 ms** | `{"type":"end","ticks":14400,"state":"lost","score":0}` |
| 2 | `--scenario survive-night2 --ticks 16200` (Mây có 999 Ngọn Lửa để sống tới bình minh, mọi thứ khác tự sinh) | **371 ms** | `{"type":"end","ticks":16200,"state":"lost","score":0}` |
| 3 | `--scenario survive-night3 --ticks 18000` (Mây có 999 Ngọn Lửa để sống tới bình minh, mọi thứ khác tự sinh) | **501 ms** | `{"type":"end","ticks":18000,"state":"lost","score":0}` |

