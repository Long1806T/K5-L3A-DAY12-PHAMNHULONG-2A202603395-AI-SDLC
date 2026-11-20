# Phase 2 · Truy vết yêu cầu → bằng chứng

Mốc: tag `phase-2`. Chạy lại toàn bộ: `npm test && npm run proof -- --phase 2`; ảnh: `node tools/capture.mjs --out docs/proof/phase-2/screens`.
[proof.md](proof.md), [test-report.txt](test-report.txt), [runs/](runs/) và [screens/capture-report.json](screens/capture-report.json) do tool sinh ra, không sửa tay.
Tiêu chí P2-x định nghĩa trong [docs/notes/phase-2.md](../../notes/phase-2.md).

| ID | Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| P2-1 | Số chuẩn, contract v1.1 | `contract.test.js` so từng khóa với Ticket-02 | test-report | Đạt |
| P2-2 | Lướt | scenario `dash` qua CLI: sự kiện tick 11 và 101, 2,8 m, hồi 90 tick | [runs/dash.jsonl](runs/dash.jsonl) | Đạt |
| P2-3 | Rơi khỏi đảo | scenario `fall`: `player_hit {by: fall, lost: 4}` đúng 1 lần, hồi sinh (0,0,0) sau 60 tick, bất tử | [runs/fall.jsonl](runs/fall.jsonl) | Đạt |
| P2-4 | Bản đồ 3 Đêm | `maps.test.js` (đèn, điểm sinh, mặt đất, thời lượng); `--night 2/3` qua CLI | test-report | Đạt |
| P2-5 | Bục nhảy | scenario `pad-night2` (bay ~85 tick, đáp đảo B), `pad-night3` (đáp tầng 2, Y = 6) | runs/pad-night2, pad-night3; [screens/08](screens/08-night2-pad.png), [11](screens/11-night3-pad.png) | Đạt |
| P2-6 | Tầng, vách, dốc, tháp (Đêm 3) | `maps.test.js`: bị vách chặn, rơi xuống tầng dưới, đi dốc lên tầng 1, tháp chặn ở r = 2 | test-report | Đạt |
| P2-7 | Gió Lạc | 3 scenario: cướp (tick 76, biến mất ở tick 316), Tỏa Sáng lúc chase (bỏ chạy, không cướp), Tỏa Sáng lúc flee có đồ (`drifter_drop`, 3 đom đóm rơi, biến mất sau 120 tick) | runs/drifter-*; [screens/07](screens/07-night2-bridge.png) | Đạt |
| P2-8 | Bùa Gió | scenario `charm`: `charm_picked {600}`, vận tốc 7,2, lướt ở tick 21 và 41 (không hồi chiêu), xuất hiện lại ở tick 2710 | [runs/charm.jsonl](runs/charm.jsonl) | Đạt |
| P2-9 | Gió mạnh Đêm 3 | scenario `wind`: active ở sim tick 1800–2099, đẩy đúng 2 m/s theo `dir_deg`; `wind_enabled:false` thì không đẩy | runs/wind; [screens/09](screens/09-night3-warn.png) (lá báo trước), [10](screens/10-night3-wind.png) | Đạt |
| P2-10 | Tạm dừng (contract) | scenario `pause`: `paused` tick 31, `resumed` tick 91, sim_tick đứng ở 30, state `paused` | [runs/pause.jsonl](runs/pause.jsonl) | Đạt |
| P2-11 | Bóng Mực chuẩn | `sim.test.js`: tốc độ 4, phát hiện 12 / bỏ 18, chạm → recoil 2 m / 60 tick, chạm lại đúng tick 91, 181, tối đa 1 lửa/tick; sinh 2 con ở tick 300 rồi mỗi 8 s | test-report | Đạt |
| P2-12 | Vùng an toàn chuẩn | scenario `safe-zone-expel` (đẩy ra mép trong 30 tick, không sát thương); `safe-zone` (khoảng cách nhỏ nhất 6,009 m) | runs/safe-zone*; proof.md §2 | Đạt |
| P2-13 | Đom đóm chuẩn | `sim.test.js`: 20 điểm khác nhau, +1 mỗi 240 tick, hết điểm trống thì bỏ lượt; scenario `hit-drop` (rơi ra vành, sống 480 tick) | test-report, runs/hit-drop | Đạt |
| P2-14 | Snapshot/scenario/input v1.1 | `headless-cli.test.js` kiểm tra đủ khóa, `night_start`, file lỗi mới → exit 2 | test-report, proof.md §3 | Đạt |
| P2-15 | Headless ≤ 30 s / Đêm | proof.md §6: Đêm 1/2/3 đầy đủ (18 000 / 19 800 / 21 600 tick) | proof.md §6 (dưới 0,5 s) | Đạt |
| P2-16 | Chuỗi 3 Đêm | capture: menu → giới thiệu (Ông Đăng) → chơi → kết quả thua/thắng → Bình Minh | [screens/01](screens/01-menu.png), [02](screens/02-intro.png), [12](screens/12-result-lost.png), [13](screens/13-result-won.png), [14](screens/14-dawn.png) | Đạt |
| P2-17 | Menu tạm dừng | capture: Esc → state `paused`, sim_tick không tăng trong 1 s | [screens/05](screens/05-pause.png), `checks.simTickFrozenWhilePaused` | Đạt |
| P2-18 | Cài đặt lưu lại | capture: đặt âm lượng 35, độ nhạy 1,5 → tải lại trang → còn nguyên | [screens/06](screens/06-settings.png), `checks.settingsAfterReload` | Đạt |
| P2-19 | Âm thanh | capture đếm số lần phát: nhặt, thắp, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược | `checks.soundsPlayed`, `soundsMissing: []` | Đạt (đếm lời gọi phát; trong Chrome headless không có loa nên không nghe thử) |
| P2-20 | HUD đầy đủ | capture: bố cục; mũi tên khi đèn ngoài màn hình; đồng hồ đỏ nhấp nháy ≤ 30 s (CSS `danger blink`) | [screens/03](screens/03-night1-hud.png), [04](screens/04-arrow.png), `checks.arrowVisible` | Đạt |
| P2-21 | Bảng màu chuẩn + ánh sáng môi trường | `palette.test.js` (hex trùng 100%, công thức 0,15 + 0,55 × tỉ lệ) | test-report | Đạt |
| P2-22 | ≥ 30 FPS ở 1280×720 | capture đo trong Chrome headless + SwiftShader (WebGL phần mềm, 2 vCPU, không GPU) | `checks.fps` | **Chưa chứng minh được**: máy đo không có GPU nên chỉ đạt vài FPS. Phần việc JS của game mỗi khung chỉ ~1 ms (p95 ~4 ms), nghĩa là CPU không phải nút thắt. Cần đo lại trên máy có GPU (`?fps=1`); Phase 4 có lệnh bench chuẩn |

## Regression Phase 1

Test Phase 1 chạy lại với số chuẩn: 33 test trong `sim.test.js`, CLI, tất định. Test nào đổi kỳ vọng đều có comment `P2:`
ghi lý do, liệt kê ở [phase-2.md §1](../../notes/phase-2.md). Scenario `scenarios/phase1/` được cập nhật theo số chuẩn
(mang 10 đom đóm để thắp đèn; L1 đặt `lit: true` trong safe-zone vì chỉ đèn sáng mới có vùng an toàn).
