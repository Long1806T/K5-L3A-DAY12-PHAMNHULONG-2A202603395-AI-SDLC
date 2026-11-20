# Phase 3 · Truy vết yêu cầu → bằng chứng

Mốc: tag `phase-3`. Chạy lại: `npm test && npm run proof -- --phase 3`; ảnh: `node tools/capture.mjs --phase 3`.
Quyết định thiết kế: [ADR 0001](../../adr/0001-lantern-fuel-and-dawn-win.md). Tiêu chí P3-x: [phase-3.md](../../notes/phase-3.md).

| ID | Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| P3-1 | Contract v1.2 | `contract.test.js`: khóa mới, thời lượng 240/270/300, điểm mới | test-report | Đạt |
| P3-2 | Hao 1/s, đơn vị nguyên 1/60, snapshot 1 chữ số | scenario `fuel-out`: 1,5 → 1,0 ở tick 30 | [runs/fuel-out.jsonl](runs/fuel-out.jsonl) | Đạt |
| P3-3 | Hết dầu → tắt ngay sau bước 2 | `lantern_out` đúng tick 90, `deposited 0`, `ever_lit true`, `fuel 0` | runs/fuel-out | Đạt |
| P3-4 | Châm dầu, đèn đầy không được chọn | scenario `refuel` (6 đom đóm vì hao trước ở bước 2); test tắt hao để kiểm tra đèn đầy | [runs/refuel.jsonl](runs/refuel.jsonl), test-report | Đạt |
| P3-5 | Thắp lại 5 đom đóm, +40, `relight`, `relit_count` | scenario `relight` | [runs/relight.jsonl](runs/relight.jsonl) | Đạt |
| P3-6 | fuel < 30 mất vùng an toàn, đúng 30 vẫn còn | test đặt fuel đúng 30,0 ở tick 1 (bị chặn) và 29,98 ở tick 2 (vào được) | test-report | Đạt |
| P3-7 | drain 5/s cộng dồn, `fuel_drain` mỗi 60 tick | scenario `drain` (61, 121, 181, 241; tắt ở 251); test 2 Bóng Mực cộng dồn | [runs/drain.jsonl](runs/drain.jsonl) | Đạt |
| P3-8 | drain → chase / stunned (+15) / wander; châm lên ≥ 30 đẩy ra mép | scenario `drain-refuel` (không bị chạm, ≥ 6 m ở tick 30); test chase/pulse | [runs/drain-refuel.jsonl](runs/drain-refuel.jsonl) | Đạt |
| P3-9 | Thắng bình minh ≥ ceil(0,6 × tổng); thua dawn; không thắng sớm; no_flames ưu tiên | scenario `dawn-win` (điểm 3 × (50 + 99) + 150 = 597), `dawn-lose`; test đủ 5 đèn vẫn chơi tiếp; test mất lửa ở tick bình minh | runs/dawn-*, [screens/07](screens/07-dawn-survived.png), [08](screens/08-dawn-lost.png) | Đạt |
| P3-10 | Sức chứa tăng dần, tối đa 20 | test: 2 lần thắp → 14; 9 lần → 20; đèn đặt sẵn không tính; thắp xong → 12 | test-report | Đạt |
| P3-11 | Điểm mới | kỳ vọng điểm trong mọi test, scenario `refuel` (30), `relight` (65), `dawn-win` (597) | test-report, runs | Đạt |
| P3-12 | Scenario v1.2 | `fuel`/`ever_lit`/`successful_lights`/`target_lantern_id`; fuel âm → exit 2 | test-report, proof.md §3 | Đạt |
| P3-13 | Thanh dầu, nhấp nháy 1 Hz khi < 30 | capture: thanh trên L1 (79) và L2 (⚠ 20, class `low` = CSS 1 s steps) | [screens/01](screens/01-fuel-bars.png), [02](screens/02-fuel-blink.png), `checks.fuelBars` | Đạt |
| P3-14 | Bảng màu dễ phân biệt (được lưu) | capture: lưu setting → tải lại trang → `--danger` = #FFFFFF, viền/mắt Bóng Mực #00B3FF, đèn tắt xẹp 20 % có vết rách, thanh dầu "⚠ 14" màu trắng; ảnh 06 cùng cảnh với bảng màu thường | [screens/05](screens/05-colorblind.png), [06](screens/06-normal-colors.png), `checks.colorBlind` | Đạt |
| P3-15 | Test ẩn Phase 1–2 không bị thay vẫn đạt | chạy nguyên `tests/` của `phase-2` trên code Phase 3: 58/70 đạt, 12 test đỏ đều thuộc luật bị thay (10 sửa kèm `P3:`, 2 xóa có lý do); bộ test hiện tại 81/81 xanh | [proof.md §1](proof.md), [phase-3.md §1](../../notes/phase-3.md) | Đạt |

Changelog liệt kê thay đổi phá vỡ tương thích: [CHANGELOG.md](../../../CHANGELOG.md) mục phase-3.
