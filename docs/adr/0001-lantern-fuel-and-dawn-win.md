# ADR 0001: Đèn có nhiên liệu, thắng khi trụ tới bình minh

- Trạng thái: **Chấp nhận** (Phase 3, Ticket-03 "Đèn cạn dầu", Contract v1.2)
- Thay thế: luật Phase 2 "đèn sáng là sáng mãi", "thắng ngay khi mọi đèn sáng", "Bóng Mực không bao giờ vào vùng an toàn", công thức điểm Ticket-02.

## Bối cảnh

Playtest: người chơi giỏi thắp hết đèn trong 2 phút, cuối Đêm hết căng thẳng. Mục tiêu đổi từ "thắp hết" sang "giữ đảo sáng tới bình minh".

## Quyết định

### 1. Mô hình trạng thái của một Đèn Lồng Lớn

```
            nạp đủ 10 (lần đầu)                 fuel ≤ 0 (hao + bị hút)
  [CHƯA TỪNG SÁNG] ───────────────► [SÁNG, fuel] ───────────────────► [TẮT, ever_lit]
   ever_lit=false                    │  ▲   fuel<30 = "yếu":           │
                                     │  │   mất vùng an toàn,          │ nạp đủ 5 (relight_cost)
                                     │  │   Bóng Mực wander tới hút    │
                                     └──┘ châm dầu (E): +10 fuel/đom đóm ◄───────────────┘
```

- Mỗi đèn có: `lit`, `deposited` (tiến độ thắp, về 0 khi tắt), `fuel`, `ever_lit`, `relit_count`.
- `fuel` lưu bằng **số nguyên đơn vị 1/60** (tối đa 6000), nên hao 1/s = trừ 1 mỗi tick và hút 5/s = trừ 5 mỗi tick. Không có sai số số thực. Chỉ làm tròn 1 chữ số thập phân khi ghi ra snapshot.
- Một lần bấm E chọn đèn **nhận được** gần nhất (chưa sáng, hoặc sáng nhưng chưa đầy), bằng nhau thì id nhỏ hơn. Đèn chưa sáng thì nạp; đèn đang sáng thì châm dầu: `used = min(mang, ceil((100 − fuel)/10))`.

### 2. Bóng Mực có thêm trạng thái `drain`

- Chỉ Bóng Mực ở `wander` mới chọn đèn yếu gần nhất (fuel < 30). Tới trong 2 m thì chuyển sang `drain`, đứng yên, hút 5/s (cộng dồn nhiều con).
- Rời `drain`: sang `chase` nếu Mây vào trong 6 m; sang `stunned` nếu trúng Tỏa Sáng; sang `wander` nếu đèn tắt, được châm lên ≥ 30, hoặc cách đèn > 2 m.
- Đèn được châm từ < 30 lên ≥ 30 có tác dụng như vừa thắp: Bóng Mực trong 6 m bị đẩy ra mép trong 30 tick và không gây sát thương lúc đó.

### 3. Luật thắng mới

Không còn thắng sớm. Ở bước "xét thắng/thua" (sau mọi cập nhật, kể cả tick bình minh), xét theo thứ tự:

1. Hết Ngọn Lửa → thua, lý do `no_flames`.
2. Hết giờ, số đèn đang sáng ≥ ceil(0,6 × tổng) → thắng, lý do `dawn_survived`.
3. Hết giờ, còn lại → thua, lý do `dawn`.

### 4. Thứ tự tick

Giữ 11 bước của Ticket-02 và chèn thêm hai việc:

- Bước 2 trừ dầu (hao + hút) và phát `fuel_drain` mỗi 60 tick hút.
- Ngay sau bước 2, đèn có fuel ≤ 0 tắt và phát `lantern_out`.

## Hệ quả

- Tuning v1.2 thêm `fuel_*`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max`. Điểm có khóa mới `per_relight`, `per_stun_drain`, `per_lit_at_dawn`; `per_second_left = 0` (bỏ thưởng thời gian).
- Test bị luật mới làm sai đã được **sửa kèm lý do** (comment `P3:`) hoặc **xóa có ghi lý do** (xem `docs/notes/phase-3.md` §1). Không có test nào bị skip.
- Bot tự chơi đổi chiến thuật: ưu tiên châm dầu cho đèn yếu, sau đó mới thắp thêm đèn.
