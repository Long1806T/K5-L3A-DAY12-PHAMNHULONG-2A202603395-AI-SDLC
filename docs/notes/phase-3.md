# Phase 3 · Ticket-03 "Đèn cạn dầu" (Change Request) + Test Contract v1.2

Quyết định thiết kế: [ADR 0001](../adr/0001-lantern-fuel-and-dawn-win.md).

## 1. Luật bị thay và test cũ bị ảnh hưởng

| Luật cũ [THAY THẾ] | Luật mới | Test cũ: sửa hay xóa |
|---|---|---|
| Đèn sáng không nhận thêm đom đóm | Châm dầu: +10 fuel mỗi đom đóm, đèn đầy không được chọn | Sửa "buttons trigger…": L1 đã sáng vẫn có thể được chọn để châm dầu |
| Thắng ngay khi mọi đèn sáng (`all_lit`) | Thắng ở bình minh nếu ≥ ceil(0,6 × tổng) đèn đang sáng (`dawn_survived`) | **Xóa** 2 test thắng sớm (vì luật bị bỏ), thay bằng 4 test bình minh |
| Thời lượng 300/330/360 s | 240/270/300 s | Sửa test contract và test bản đồ |
| Đèn sáng luôn có vùng an toàn | Đèn yếu (fuel < 30) mất vùng an toàn | Test vùng an toàn giữ nguyên (fuel 100 → 85 sau 900 tick, vẫn ≥ 30), thêm test đèn yếu |
| Bóng Mực không bao giờ vào vùng an toàn | Trạng thái `drain` hút dầu đèn yếu | Thêm test drain |
| Điểm Ticket-02 (+10/đom đóm, thưởng giây còn lại) | +5/đom đóm nạp, +100 thắp lần đầu, +40 thắp lại, +5/+15 Tỏa Sáng, bình minh +50 + floor(fuel)/đèn + 50/lửa | Sửa mọi kỳ vọng điểm |
| Sức chứa cố định 10 | 10 + 2 × số lần thắp thành công, tối đa 20 | Sửa test sức chứa |
| Scenario Phase 1 `win-last-lantern` (thắng ở tick 21) | Không thắng sớm: thắp đèn cuối, Đêm vẫn tiếp tục | Sửa kỳ vọng trong `headless-cli.test.js` |

## 2. Tiêu chí nghiệm thu

| ID | Tiêu chí | Kiểm chứng |
|---|---|---|
| P3-1 | Contract v1.2: các khóa tuning mới, thời lượng 240/270/300 | `contract.test.js` |
| P3-2 | Đèn vừa thắp: fuel = 100. Hao 1/s theo đơn vị nguyên 1/60. Snapshot `fuel` 1 chữ số, đèn tắt = 0 | `fuel.test.js`, scenario `fuel-out` |
| P3-3 | fuel ≤ 0 → tắt ngay sau bước 2: `lantern_out`, `deposited = 0`, `ever_lit = true` | scenario `fuel-out` |
| P3-4 | Châm dầu: `used = min(mang, ceil((100 − fuel)/10))`, sự kiện `refuel`, đèn đầy không được chọn | scenario `refuel` |
| P3-5 | Thắp lại đèn đã từng sáng cần 5; `lantern_lit.relight`, `relit_count`; đèn chưa từng sáng vẫn cần 10 | scenario `relight` |
| P3-6 | Đèn yếu (< 30) mất vùng an toàn; đúng 30 vẫn còn | `fuel.test.js` |
| P3-7 | Bóng Mực wander tới đèn yếu gần nhất, ≤ 2 m → `drain`, hút 5/s cộng dồn, `fuel_drain` mỗi 60 tick | scenario `drain` |
| P3-8 | drain → chase (Mây ≤ 6 m) / stunned (Tỏa Sáng, +15) / wander (đèn tắt, châm lên ≥ 30, > 2 m); châm lên ≥ 30 đẩy Bóng Mực ra mép trong 30 tick | `fuel.test.js`, scenario `drain-refuel` |
| P3-9 | Thắng ở bình minh nếu đèn sáng ≥ ceil(0,6 × tổng) (`dawn_survived`), thua `dawn` nếu thiếu; không thắng sớm; hết lửa ở tick cuối vẫn thua `no_flames` | scenario `dawn-win`, `dawn-lose`, `fuel.test.js` |
| P3-10 | Sức chứa = 10 + 2 × số lần thắp thành công (cả thắp lại), tối đa 20; đèn đặt sẵn không tính; `player.capacity` | `fuel.test.js` |
| P3-11 | Điểm mới (Phần 5 của ticket) | `fuel.test.js` |
| P3-12 | Scenario v1.2: `lit/fuel/ever_lit` cho đèn, `successful_lights`, `target_lantern_id` | `headless-cli.test.js` |
| P3-13 | Thanh dầu trên đèn sáng; fuel < 30 thì đèn và thanh nhấp nháy 1 Hz | ảnh capture |
| P3-14 | Chế độ "Bảng màu dễ phân biệt" (được lưu): viền/mắt Bóng Mực #00B3FF, cảnh báo UI #FFFFFF + ⚠, đèn tắt xẹp 20% và giấy rách | ảnh capture + `capture-report.json` |
| P3-15 | Test ẩn Phase 1–2 không bị thay thế vẫn đạt | toàn bộ test cũ còn hiệu lực xanh |

## 3. Giả định

| # | Chỗ chưa rõ | Giả định |
|---|---|---|
| K1 | Thứ tự xét khi Bóng Mực đang `drain` | Mây trong 6 m → chase được xét trước, sau đó mới tới các điều kiện về wander |
| K2 | Đèn đặt `lit: true` bằng scenario | `ever_lit = true` nếu không ghi. `fuel` mặc định 100. Không tính vào `successful_lights` |
| K3 | Đèn "đầy" | fuel đúng 100 (6000/6000 đơn vị). Sau một tick hao, đèn đã nhận được 1 đom đóm |
| K4 | Điểm khi thua | Dòng `end` vẫn ghi điểm tích lũy của Đêm. Thưởng bình minh chỉ cộng khi thắng |
| K5 | `fuel_drain` | Mỗi Bóng Mực có bộ đếm riêng: cứ đủ 60 tick hút liên tục thì ghi 1 sự kiện (fuel sau khi trừ) |

## 4. Đánh giá Phase 3

- **Đạt:** 15/15 tiêu chí ([bảng truy vết](../proof/phase-3/README.md)). 81 test xanh. Đêm dài nhất chạy headless trong khoảng 0,5 s. Bot thắng Đêm 1 với luật mới.
- **Hồi quy:** Chạy nguyên `tests/` của `phase-2` trên code mới ([proof.md §1](../proof/phase-3/proof.md)): 58/70 đạt, 12 test đỏ đúng chỗ luật bị thay. 10 test sửa kèm `P3:`, 2 test thắng sớm xóa có ghi lý do. Các test Phase 1–2 còn hiệu lực giữ nguyên và xanh.
- **AI sai:** #15–#20 trong [ai-log.md](ai-log.md).
- **Chỉnh harness:** `AGENTS.md` thêm luật "dầu tính bằng số nguyên", "luật dùng chung chỉ viết một lần", "không skip test"; sửa luật 7. Proof chạy thêm 7 scenario Phase 3 và hồi quy toàn bộ scenario Phase 1–2.
